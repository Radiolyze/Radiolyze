from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

from .mock_logic import generate_asr_transcript, generate_impression, generate_inference_summary

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


def _vllm_chat_completion(prompt: str, *, model_name: str, system_prompt: str) -> str:
    url = f"{_vllm_base_url()}/chat/completions"
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
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


def _build_impression_prompt(findings_text: str) -> str:
    return (
        "Create a concise radiology impression based on these findings.\n\n"
        f"Findings:\n{findings_text}\n\n"
        "Return only the impression."
    )


def _build_summary_prompt(findings_text: str) -> str:
    return (
        "Summarize the imaging findings in one or two sentences.\n\n"
        f"Findings:\n{findings_text}\n\n"
        "Return only the summary."
    )


def generate_impression_text(findings_text: str | None) -> tuple[str, float, str, dict[str, Any]]:
    findings_text = (findings_text or "").strip()
    if not findings_text or not _env_flag("VLLM_ENABLED", False):
        text, confidence = generate_impression(findings_text)
        return text, confidence, "mock-impression-v1", {"provider": "mock"}

    model_name = _vllm_model_name()
    try:
        start_time = time.monotonic()
        text = _vllm_chat_completion(
            _build_impression_prompt(findings_text),
            model_name=model_name,
            system_prompt=os.getenv(
                "VLLM_SYSTEM_PROMPT",
                "You are a radiology assistant. Respond clearly and concisely.",
            ),
        )
        latency_ms = int((time.monotonic() - start_time) * 1000)
        confidence = _env_float("VLLM_DEFAULT_CONFIDENCE", 0.0)
        return text, confidence, model_name, _compact_metadata({"provider": "vllm", "latency_ms": latency_ms})
    except Exception as exc:
        logger.warning("vLLM impression failed: %s", exc)
        if _env_flag("VLLM_FALLBACK_TO_MOCK", True):
            text, confidence = generate_impression(findings_text)
            return text, confidence, "mock-impression-v1", {"provider": "mock", "error": str(exc)}
        raise RuntimeError("vLLM impression failed") from exc


def generate_inference_summary_text(findings_text: str | None, model_name: str | None = None) -> tuple[
    str, float | None, str, dict[str, Any]
]:
    findings_text = (findings_text or "").strip()
    if not findings_text or not _env_flag("VLLM_ENABLED", False):
        text, confidence = generate_inference_summary(findings_text)
        return text, confidence, model_name or "mock-medgemma-0.1", {"provider": "mock"}

    resolved_model = _vllm_model_name(model_name)
    try:
        start_time = time.monotonic()
        text = _vllm_chat_completion(
            _build_summary_prompt(findings_text),
            model_name=resolved_model,
            system_prompt=os.getenv(
                "VLLM_SYSTEM_PROMPT",
                "You are a radiology assistant. Respond clearly and concisely.",
            ),
        )
        latency_ms = int((time.monotonic() - start_time) * 1000)
        confidence = _env_float("VLLM_DEFAULT_CONFIDENCE", 0.0)
        return text, confidence, resolved_model, _compact_metadata({"provider": "vllm", "latency_ms": latency_ms})
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
