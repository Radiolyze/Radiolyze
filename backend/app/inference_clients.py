from __future__ import annotations

import base64
import json
import logging
import mimetypes
import os
import time
from pathlib import Path
from typing import Any

import httpx

from .mock_logic import generate_asr_transcript, generate_impression, generate_inference_summary
from .prompts import render_prompt_text

logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _compact_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in metadata.items() if value is not None}


def _normalize_list(values: list[str] | None) -> list[str]:
    if not values:
        return []
    return [value.strip() for value in values if isinstance(value, str) and value.strip()]


def _encode_image_path(path: str) -> str:
    file_path = Path(path)
    if not file_path.is_file():
        raise RuntimeError(f"Image path not found: {path}")
    mime_type, _ = mimetypes.guess_type(file_path.name)
    if not mime_type:
        mime_type = "image/jpeg"
    encoded = base64.b64encode(file_path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _build_multimodal_content(prompt: str, image_urls: list[str], image_paths: list[str]) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for url in image_urls:
        content.append({"type": "image_url", "image_url": {"url": url}})
    for path in image_paths:
        content.append({"type": "image_url", "image_url": {"url": _encode_image_path(path)}})
    return content


def _build_image_manifest(
    image_urls: list[str] | None,
    image_paths: list[str] | None,
    image_refs: list[dict[str, Any]] | None,
) -> str:
    normalized_urls = _normalize_list(image_urls)
    normalized_paths = _normalize_list(image_paths)
    if image_refs:
        lines: list[str] = []
        for index, ref in enumerate(image_refs, start=1):
            if not isinstance(ref, dict):
                continue
            role = ref.get("role")
            if role not in {"current", "prior"}:
                role = None
            study_date = ref.get("study_date") or ref.get("studyDate")
            series_description = ref.get("series_description") or ref.get("seriesDescription")
            series_modality = ref.get("series_modality") or ref.get("seriesModality")
            frame_index = ref.get("frame_index") if "frame_index" in ref else ref.get("frameIndex")
            stack_index = ref.get("stack_index") if "stack_index" in ref else ref.get("stackIndex")

            parts = [f"{index})"]
            if role:
                parts.append(f"role={role}")
            if study_date:
                parts.append(f"study_date={study_date}")
            if series_description:
                parts.append(f"series={series_description}")
            if series_modality:
                parts.append(f"modality={series_modality}")
            if isinstance(frame_index, int):
                parts.append(f"frame={frame_index}")
            if isinstance(stack_index, int):
                parts.append(f"stack={stack_index}")
            lines.append(" ".join(parts))

        if lines:
            return "\n".join(lines)

    if not (normalized_urls or normalized_paths):
        return ""

    lines: list[str] = []
    for index in range(len(normalized_urls)):
        lines.append(f"{index + 1}) source=url")
    for index in range(len(normalized_paths)):
        lines.append(f"{len(lines) + index + 1}) source=path")
    return "\n".join(lines)


def _strip_code_fences(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _parse_json_response(text: str) -> tuple[dict[str, Any] | None, str | None]:
    candidate = _strip_code_fences(text)
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None, "no_json_object"
    candidate = candidate[start : end + 1]
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        return None, str(exc)
    if not isinstance(parsed, dict):
        return None, "json_not_object"
    return parsed, None


def _extract_json_text(payload: dict[str, Any] | None, key: str) -> str | None:
    if not payload:
        return None
    value = payload.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _vllm_base_url() -> str:
    return os.getenv("VLLM_BASE_URL", "http://vllm-medgemma:8000/v1").rstrip("/")


def _vllm_model_name(model_name: str | None = None) -> str:
    return model_name or os.getenv("VLLM_MODEL_NAME", "medgemma-radiology")


def _vllm_timeout() -> float:
    return float(_env_int("VLLM_REQUEST_TIMEOUT", 60))


def _vllm_headers() -> dict[str, str]:
    api_key = os.getenv("VLLM_API_KEY")
    if not api_key:
        return {}
    return {"Authorization": f"Bearer {api_key}"}


def _vllm_chat_completion(
    prompt: str,
    *,
    model_name: str,
    system_prompt: str,
    image_urls: list[str] | None = None,
    image_paths: list[str] | None = None,
) -> str:
    url = f"{_vllm_base_url()}/chat/completions"
    normalized_urls = _normalize_list(image_urls)
    normalized_paths = _normalize_list(image_paths)
    has_images = bool(normalized_urls or normalized_paths)
    content: str | list[dict[str, Any]]
    if has_images:
        content = _build_multimodal_content(prompt, normalized_urls, normalized_paths)
    else:
        content = prompt
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
        "max_tokens": _env_int("VLLM_MAX_TOKENS", 512),
        "temperature": _env_float("VLLM_TEMPERATURE", 0.1),
        "top_p": _env_float("VLLM_TOP_P", 0.9),
    }
    with httpx.Client(timeout=_vllm_timeout()) as client:
        response = client.post(url, json=payload, headers=_vllm_headers())
        response.raise_for_status()
        data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("vLLM returned no choices")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if not content:
        raise RuntimeError("vLLM returned empty content")
    return content.strip()


def _build_impression_prompt(findings_text: str | None, image_manifest: str | None) -> str:
    return render_prompt_text(
        "impression",
        {
            "findings_text": (findings_text or "").strip(),
            "image_manifest": image_manifest or "",
        },
    )


def _build_summary_prompt(findings_text: str | None, image_manifest: str | None) -> str:
    return render_prompt_text(
        "summary",
        {
            "findings_text": (findings_text or "").strip(),
            "image_manifest": image_manifest or "",
        },
    )


def generate_impression_text(
    findings_text: str | None,
    *,
    image_urls: list[str] | None = None,
    image_paths: list[str] | None = None,
    image_refs: list[dict[str, Any]] | None = None,
) -> tuple[str, float, str, dict[str, Any]]:
    findings_text = (findings_text or "").strip()
    has_images = bool(_normalize_list(image_urls) or _normalize_list(image_paths))
    if (not findings_text and not has_images) or not _env_flag("VLLM_ENABLED", False):
        text, confidence = generate_impression(findings_text)
        return text, confidence, "mock-impression-v1", {"provider": "mock"}

    image_manifest = _build_image_manifest(image_urls, image_paths, image_refs)
    model_name = _vllm_model_name()
    try:
        start_time = time.monotonic()
        raw_text = _vllm_chat_completion(
            _build_impression_prompt(findings_text, image_manifest),
            model_name=model_name,
            system_prompt=render_prompt_text("system"),
            image_urls=image_urls,
            image_paths=image_paths,
        )
        parsed, parse_error = _parse_json_response(raw_text)
        json_text = _extract_json_text(parsed, "impression")
        text = json_text or raw_text
        latency_ms = int((time.monotonic() - start_time) * 1000)
        confidence = _env_float("VLLM_DEFAULT_CONFIDENCE", 0.0)
        json_metadata = {}
        if json_text:
            json_metadata["json_parsed"] = True
        elif parse_error:
            json_metadata["json_parsed"] = False
            json_metadata["json_error"] = parse_error
        else:
            json_metadata["json_parsed"] = False
            json_metadata["json_error"] = "missing_impression"
        return text, confidence, model_name, _compact_metadata(
            {"provider": "vllm", "latency_ms": latency_ms, **json_metadata}
        )
    except Exception as exc:
        logger.warning("vLLM impression failed: %s", exc)
        if _env_flag("VLLM_FALLBACK_TO_MOCK", True):
            text, confidence = generate_impression(findings_text)
            return text, confidence, "mock-impression-v1", {"provider": "mock", "error": str(exc)}
        raise RuntimeError("vLLM impression failed") from exc


def generate_inference_summary_text(
    findings_text: str | None,
    model_name: str | None = None,
    *,
    image_urls: list[str] | None = None,
    image_paths: list[str] | None = None,
    image_refs: list[dict[str, Any]] | None = None,
) -> tuple[str, float | None, str, dict[str, Any]]:
    findings_text = (findings_text or "").strip()
    has_images = bool(_normalize_list(image_urls) or _normalize_list(image_paths))
    if (not findings_text and not has_images) or not _env_flag("VLLM_ENABLED", False):
        text, confidence = generate_inference_summary(findings_text)
        return text, confidence, model_name or "mock-medgemma-0.1", {"provider": "mock"}

    image_manifest = _build_image_manifest(image_urls, image_paths, image_refs)
    resolved_model = _vllm_model_name(model_name)
    try:
        start_time = time.monotonic()
        raw_text = _vllm_chat_completion(
            _build_summary_prompt(findings_text, image_manifest),
            model_name=resolved_model,
            system_prompt=render_prompt_text("system"),
            image_urls=image_urls,
            image_paths=image_paths,
        )
        parsed, parse_error = _parse_json_response(raw_text)
        json_text = _extract_json_text(parsed, "summary")
        text = json_text or raw_text
        latency_ms = int((time.monotonic() - start_time) * 1000)
        confidence = _env_float("VLLM_DEFAULT_CONFIDENCE", 0.0)
        json_metadata = {}
        if json_text:
            json_metadata["json_parsed"] = True
        elif parse_error:
            json_metadata["json_parsed"] = False
            json_metadata["json_error"] = parse_error
        else:
            json_metadata["json_parsed"] = False
            json_metadata["json_error"] = "missing_summary"
        return text, confidence, resolved_model, _compact_metadata(
            {"provider": "vllm", "latency_ms": latency_ms, **json_metadata}
        )
    except Exception as exc:
        logger.warning("vLLM inference failed: %s", exc)
        if _env_flag("VLLM_FALLBACK_TO_MOCK", True):
            text, confidence = generate_inference_summary(findings_text)
            return text, confidence, model_name or "mock-medgemma-0.1", {"provider": "mock", "error": str(exc)}
        raise RuntimeError("vLLM inference failed") from exc


async def transcribe_audio(
    *,
    content: bytes,
    filename: str,
    content_type: str | None,
) -> tuple[str, float, str, dict[str, Any]]:
    if not _env_flag("MEDASR_ENABLED", False):
        text, confidence = generate_asr_transcript()
        return text, confidence, "mock-medasr-0.1", {"provider": "mock"}

    base_url = os.getenv("MEDASR_BASE_URL", "http://medasr:8001").rstrip("/")
    path = os.getenv("MEDASR_TRANSCRIBE_PATH", "/v1/audio/transcriptions")
    url = f"{base_url}{path}"
    model_name = os.getenv("MEDASR_MODEL", "google/medasr")
    timeout = float(_env_int("MEDASR_REQUEST_TIMEOUT", 60))
    headers = {}
    api_key = os.getenv("MEDASR_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    files = {"file": (filename, content, content_type or "application/octet-stream")}
    data = {"model": model_name}
    try:
        start_time = time.monotonic()
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, data=data, files=files, headers=headers)
            response.raise_for_status()
            try:
                payload = response.json()
            except ValueError:
                payload = {"text": response.text}
        text = payload.get("text") or payload.get("transcript")
        if not text and isinstance(payload.get("segments"), list):
            text = " ".join(segment.get("text", "") for segment in payload["segments"]).strip()
        if not text:
            raise RuntimeError("MEDASR returned no transcript")
        confidence = payload.get("confidence")
        if confidence is None:
            confidence = _env_float("MEDASR_DEFAULT_CONFIDENCE", 0.0)
        latency_ms = int((time.monotonic() - start_time) * 1000)
        return text, float(confidence), model_name, _compact_metadata({"provider": "medasr", "latency_ms": latency_ms})
    except Exception as exc:
        logger.warning("MEDASR transcription failed: %s", exc)
        if _env_flag("MEDASR_FALLBACK_TO_MOCK", True):
            text, confidence = generate_asr_transcript()
            return text, confidence, "mock-medasr-0.1", {"provider": "mock", "error": str(exc)}
        raise RuntimeError("MEDASR transcription failed") from exc
