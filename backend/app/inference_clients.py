from __future__ import annotations

import base64
import json
import logging
import mimetypes
import os
import re
import time
from pathlib import Path
from typing import Any

import httpx
from pydantic import ValidationError

from .ai_schemas import (
    SCHEMA_VERSION,
    ComparisonOutput,
    ImpressionOutput,
    LocalizeOutput,
    SummaryOutput,
    get_comparison_schema,
    get_impression_schema,
    get_summary_schema,
)
from .asr_providers import transcribe_audio
from .mock_logic import generate_impression, generate_inference_summary
from .prompts import render_prompt_with_metadata

logger = logging.getLogger(__name__)

_CRED_RE = re.compile(r"(https?://)([^:]+:[^@]+)@")


def _redact_url(url: str) -> str:
    """Replace embedded user:pass in URLs with ***:***."""
    return _CRED_RE.sub(r"\1***:***@", url)


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


def _schema_strict() -> bool:
    return _env_flag("VLLM_SCHEMA_STRICT", False)


def _compact_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in metadata.items() if value is not None}


def _normalize_list(values: list[str] | None) -> list[str]:
    if not values:
        return []
    return [value.strip() for value in values if isinstance(value, str) and value.strip()]


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _as_int(value: Any) -> int | None:
    parsed = _as_float(value)
    if parsed is None or not parsed.is_integer():
        return None
    return int(parsed)


def _format_float(value: float) -> str:
    return f"{value:.4f}".rstrip("0").rstrip(".")


def _normalize_float_list(raw: Any) -> list[float] | None:
    if not isinstance(raw, list):
        return None
    values: list[float] = []
    for entry in raw:
        parsed = _as_float(entry)
        if parsed is None:
            continue
        values.append(parsed)
    return values or None


def _encode_image_path(path: str) -> str:
    file_path = Path(path)
    if not file_path.is_file():
        raise RuntimeError(f"Image path not found: {path}")
    mime_type, _ = mimetypes.guess_type(file_path.name)
    if not mime_type:
        mime_type = "image/jpeg"
    encoded = base64.b64encode(file_path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _build_multimodal_content(
    prompt: str, image_urls: list[str], image_paths: list[str]
) -> list[dict[str, Any]]:
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
            time_delta_days = ref.get("time_delta_days") or ref.get("timeDeltaDays")
            series_description = ref.get("series_description") or ref.get("seriesDescription")
            series_modality = ref.get("series_modality") or ref.get("seriesModality")
            frame_index = ref.get("frame_index") if "frame_index" in ref else ref.get("frameIndex")
            stack_index = ref.get("stack_index") if "stack_index" in ref else ref.get("stackIndex")
            instance_number = (
                ref.get("instance_number")
                if "instance_number" in ref
                else ref.get("instanceNumber")
            )
            slice_thickness = (
                ref.get("slice_thickness")
                if "slice_thickness" in ref
                else ref.get("sliceThickness")
            )
            spacing_between_slices = (
                ref.get("spacing_between_slices")
                if "spacing_between_slices" in ref
                else ref.get("spacingBetweenSlices")
            )
            pixel_spacing = (
                ref.get("pixel_spacing") if "pixel_spacing" in ref else ref.get("pixelSpacing")
            )

            parts = [f"{index})"]
            if role:
                parts.append(f"role={role}")
            if study_date:
                parts.append(f"study_date={study_date}")
            delta_days = _as_int(time_delta_days)
            if delta_days is not None:
                parts.append(f"time_delta_days={delta_days}")
            if series_description:
                parts.append(f"series={series_description}")
            if series_modality:
                parts.append(f"modality={series_modality}")
            if isinstance(frame_index, int):
                parts.append(f"frame={frame_index}")
            if isinstance(stack_index, int):
                parts.append(f"stack={stack_index}")
            instance_number_value = _as_int(instance_number)
            if instance_number_value is not None:
                parts.append(f"instance={instance_number_value}")
            slice_value = _as_float(slice_thickness)
            if slice_value is not None:
                parts.append(f"slice_thickness={_format_float(slice_value)}")
            spacing_value = _as_float(spacing_between_slices)
            if spacing_value is not None:
                parts.append(f"spacing_between_slices={_format_float(spacing_value)}")
            pixel_values = _normalize_float_list(pixel_spacing)
            if pixel_values and len(pixel_values) >= 2:
                parts.append(
                    "pixel_spacing="
                    f"{_format_float(pixel_values[0])}x{_format_float(pixel_values[1])}"
                )
            lines.append(" ".join(parts))

        if lines:
            return "\n".join(lines)

    if not (normalized_urls or normalized_paths):
        return ""

    url_lines: list[str] = []
    for index in range(len(normalized_urls)):
        url_lines.append(f"{index + 1}) source=url")
    for index in range(len(normalized_paths)):
        url_lines.append(f"{len(url_lines) + index + 1}) source=path")
    return "\n".join(url_lines)


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


def _extract_evidence_indices(payload: dict[str, Any] | None) -> list[int] | None:
    if not payload:
        return None
    raw = payload.get("evidence_indices")
    if raw is None:
        raw = payload.get("evidenceIndices")
    if not isinstance(raw, list):
        return None
    indices: list[int] = []
    for entry in raw:
        if isinstance(entry, bool):
            continue
        if isinstance(entry, int):
            value = entry
        elif isinstance(entry, float) and entry.is_integer():
            value = int(entry)
        elif isinstance(entry, str):
            try:
                value = int(entry.strip())
            except ValueError:
                continue
        else:
            continue
        if value > 0:
            indices.append(value)
    return indices or None


def _dicom_web_base_url() -> str:
    """Get the DICOMweb base URL accessible from the backend/worker."""
    return os.getenv("DICOM_WEB_BASE_URL", "http://orthanc:8042/dicom-web").rstrip("/")


def _dicom_web_base_url_with_auth() -> str:
    """Get the DICOMweb base URL with embedded Basic Auth credentials if configured.

    Returns URL like 'http://user:pass@orthanc:8042/dicom-web' for vLLM to access.
    """
    base_url = _dicom_web_base_url()
    username = os.getenv("DICOM_WEB_USERNAME") or os.getenv("ORTHANC_USERNAME")
    password = os.getenv("DICOM_WEB_PASSWORD") or os.getenv("ORTHANC_PASSWORD")

    if not username or not password:
        return base_url

    # Parse URL and inject credentials
    # URL format: http://host:port/path -> http://user:pass@host:port/path
    if "://" in base_url:
        scheme, rest = base_url.split("://", 1)
        return f"{scheme}://{username}:{password}@{rest}"

    return base_url


def _rewrite_image_url(url: str) -> str:
    """Rewrite frontend image URLs to be accessible from the Docker network.

    Frontend URLs like 'http://localhost:5173/dicom-web/...' need to be
    rewritten to 'http://orthanc:8042/dicom-web/...' for vLLM to access.
    """
    if not url:
        return url

    # Extract the path after /dicom-web/
    dicom_web_markers = ["/dicom-web/", "/dicom-web"]
    for marker in dicom_web_markers:
        idx = url.find(marker)
        if idx != -1:
            path = url[idx + len("/dicom-web") :]
            if path.startswith("/"):
                path = path[1:]
            # Use URL with embedded auth for vLLM access
            new_url = f"{_dicom_web_base_url_with_auth()}/{path}"
            logger.debug(
                "Rewrote image URL: %s -> %s (credentials hidden)",
                url,
                _dicom_web_base_url() + "/" + path,
            )
            return new_url

    # If no dicom-web marker found, return original URL
    return url


def _rewrite_image_urls(urls: list[str] | None) -> list[str]:
    """Rewrite a list of image URLs for backend/vLLM access."""
    if not urls:
        return []
    return [_rewrite_image_url(url) for url in urls]


def _vllm_base_url() -> str:
    return os.getenv("VLLM_BASE_URL", "http://vllm-medgemma:8000/v1").rstrip("/")


def _vllm_model_name(model_name: str | None = None) -> str:
    return model_name or os.getenv("VLLM_MODEL_NAME") or "medgemma-radiology"


def _vllm_timeout() -> float:
    return float(_env_int("VLLM_REQUEST_TIMEOUT", 60))


def _vllm_headers() -> dict[str, str]:
    api_key = os.getenv("VLLM_API_KEY")
    if not api_key:
        return {}
    return {"Authorization": f"Bearer {api_key}"}


def _guided_json_enabled() -> bool:
    return _env_flag("VLLM_GUIDED_JSON", True)


def _vllm_chat_completion(
    prompt: str,
    *,
    model_name: str,
    system_prompt: str,
    image_urls: list[str] | None = None,
    image_paths: list[str] | None = None,
    guided_json_schema: dict[str, Any] | None = None,
) -> str:
    url = f"{_vllm_base_url()}/chat/completions"
    # Rewrite frontend URLs to be accessible from Docker network
    rewritten_urls = _rewrite_image_urls(image_urls)
    normalized_urls = _normalize_list(rewritten_urls)
    normalized_paths = _normalize_list(image_paths)
    if rewritten_urls != (image_urls or []):
        logger.info("Rewrote %d image URLs for vLLM access", len(normalized_urls))
    has_images = bool(normalized_urls or normalized_paths)
    content: str | list[dict[str, Any]]
    if has_images:
        content = _build_multimodal_content(prompt, normalized_urls, normalized_paths)
    else:
        content = prompt
    payload: dict[str, Any] = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
        "max_tokens": _env_int("VLLM_MAX_TOKENS", 4096),
        "temperature": _env_float("VLLM_TEMPERATURE", 0.1),
        "top_p": _env_float("VLLM_TOP_P", 0.9),
    }
    # Guided JSON decoding: enforce JSON schema at token-generation level
    if guided_json_schema and _guided_json_enabled():
        payload["response_format"] = {
            "type": "json_object",
            "schema": guided_json_schema,
        }
        logger.debug("Guided JSON enabled for this request")
    logger.info(
        "vLLM request to %s with model=%s, has_images=%s", _redact_url(url), model_name, has_images
    )
    with httpx.Client(timeout=_vllm_timeout()) as client:
        response = client.post(url, json=payload, headers=_vllm_headers())
        response.raise_for_status()
        data = response.json()
    logger.info("vLLM response keys: %s", list(data.keys()))
    # Check for error in response (vLLM may return 200 with error field)
    if data.get("error"):
        logger.error("vLLM returned error: %s", data.get("error"))
        raise RuntimeError(f"vLLM error: {data.get('error')}")
    choices = data.get("choices") or []
    if not choices:
        logger.error(
            "vLLM returned no choices. Full response: %s (truncated to 2000 chars)",
            str(data)[:2000],
        )
        raise RuntimeError("vLLM returned no choices")
    message = choices[0].get("message") or {}
    response_text: str | None = message.get("content")
    finish_reason = choices[0].get("finish_reason")
    logger.info(
        "vLLM finish_reason=%s, content_length=%d",
        finish_reason,
        len(response_text) if response_text else 0,
    )
    if not response_text:
        logger.error("vLLM returned empty content. Choice: %s", choices[0])
        raise RuntimeError("vLLM returned empty content")
    return response_text.strip()


def _build_impression_prompt(
    findings_text: str | None,
    image_manifest: str | None,
) -> tuple[str, dict[str, Any]]:
    return render_prompt_with_metadata(
        "impression",
        {
            "findings_text": (findings_text or "").strip(),
            "image_manifest": image_manifest or "",
        },
    )


def _build_summary_prompt(
    findings_text: str | None,
    image_manifest: str | None,
) -> tuple[str, dict[str, Any]]:
    return render_prompt_with_metadata(
        "summary",
        {
            "findings_text": (findings_text or "").strip(),
            "image_manifest": image_manifest or "",
        },
    )


def _parse_structured_output(
    raw_text: str,
    *,
    model_type: type[SummaryOutput] | type[ImpressionOutput],
    text_key: str,
    schema_name: str,
) -> tuple[str, dict[str, Any], list[int] | None, str | None]:
    parsed, parse_error = _parse_json_response(raw_text)
    metadata: dict[str, Any] = {"schema_name": schema_name, "schema_version": SCHEMA_VERSION}
    evidence_indices = None
    confidence_label = None

    if not parsed:
        metadata["json_parsed"] = False
        metadata["json_schema_valid"] = False
        metadata["json_error"] = parse_error or "no_json_object"
        return raw_text, metadata, None, None

    try:
        output = model_type.model_validate(parsed)
    except ValidationError:
        metadata["json_parsed"] = True
        metadata["json_schema_valid"] = False
        metadata["json_error"] = "schema_validation_failed"
        evidence_indices = _extract_evidence_indices(parsed)
        return raw_text, metadata, evidence_indices, None

    text = getattr(output, text_key, None)
    if not text:
        metadata["json_parsed"] = True
        metadata["json_schema_valid"] = False
        metadata["json_error"] = f"missing_{text_key}"
        evidence_indices = getattr(output, "evidence_indices", None)
        confidence_label = getattr(output, "confidence", None)
        return raw_text, metadata, evidence_indices, confidence_label

    metadata["json_parsed"] = True
    metadata["json_schema_valid"] = True
    evidence_indices = getattr(output, "evidence_indices", None)
    confidence_label = getattr(output, "confidence", None)
    return text, metadata, evidence_indices, confidence_label


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
        system_prompt, system_meta = render_prompt_with_metadata("system")
        prompt_text, prompt_meta = _build_impression_prompt(findings_text, image_manifest)
        raw_text = _vllm_chat_completion(
            prompt_text,
            model_name=model_name,
            system_prompt=system_prompt,
            image_urls=image_urls,
            image_paths=image_paths,
            guided_json_schema=get_impression_schema(),
        )
        text, parse_metadata, evidence_indices, confidence_label = _parse_structured_output(
            raw_text,
            model_type=ImpressionOutput,
            text_key="impression",
            schema_name="impression_output",
        )
        if _schema_strict() and not parse_metadata.get("json_schema_valid"):
            raise RuntimeError(
                f"Schema validation failed: {parse_metadata.get('json_error', 'unknown')}"
            )
        latency_ms = int((time.monotonic() - start_time) * 1000)
        confidence = _env_float("VLLM_DEFAULT_CONFIDENCE", 0.0)
        json_metadata = {
            **parse_metadata,
            "prompt": {"system": system_meta, "task": prompt_meta},
        }
        json_metadata["images_used"] = has_images
        if evidence_indices:
            json_metadata["evidence_indices"] = evidence_indices
        if has_images and not evidence_indices:
            json_metadata["evidence_missing"] = True
        if confidence_label:
            json_metadata["confidence_label"] = confidence_label
        return (
            text,
            confidence,
            model_name,
            _compact_metadata({"provider": "vllm", "latency_ms": latency_ms, **json_metadata}),
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
        system_prompt, system_meta = render_prompt_with_metadata("system")
        prompt_text, prompt_meta = _build_summary_prompt(findings_text, image_manifest)
        raw_text = _vllm_chat_completion(
            prompt_text,
            model_name=resolved_model,
            system_prompt=system_prompt,
            image_urls=image_urls,
            image_paths=image_paths,
            guided_json_schema=get_summary_schema(),
        )
        text, parse_metadata, evidence_indices, confidence_label = _parse_structured_output(
            raw_text,
            model_type=SummaryOutput,
            text_key="summary",
            schema_name="summary_output",
        )
        if _schema_strict() and not parse_metadata.get("json_schema_valid"):
            raise RuntimeError(
                f"Schema validation failed: {parse_metadata.get('json_error', 'unknown')}"
            )
        latency_ms = int((time.monotonic() - start_time) * 1000)
        confidence = _env_float("VLLM_DEFAULT_CONFIDENCE", 0.0)
        json_metadata = {
            **parse_metadata,
            "prompt": {"system": system_meta, "task": prompt_meta},
        }
        json_metadata["images_used"] = has_images
        if evidence_indices:
            json_metadata["evidence_indices"] = evidence_indices
        if has_images and not evidence_indices:
            json_metadata["evidence_missing"] = True
        if confidence_label:
            json_metadata["confidence_label"] = confidence_label
        return (
            text,
            confidence,
            resolved_model,
            _compact_metadata({"provider": "vllm", "latency_ms": latency_ms, **json_metadata}),
        )
    except Exception as exc:
        logger.warning("vLLM inference failed: %s", exc)
        if _env_flag("VLLM_FALLBACK_TO_MOCK", True):
            text, confidence = generate_inference_summary(findings_text)
            return (
                text,
                confidence,
                model_name or "mock-medgemma-0.1",
                {"provider": "mock", "error": str(exc)},
            )
        raise RuntimeError("vLLM inference failed") from exc


LOCALIZE_CXR_FINDING_PROMPT = (
    "Task: Identify and localize imaging findings in this chest radiograph.\n"
    "For each finding, provide a bounding box in normalized coordinates (0-1000 space).\n"
    "Format: box_2d = [y_min, x_min, y_max, x_max] where (0,0) is top-left.\n"
    "Return a JSON object with key 'findings' (array of objects).\n"
    'Each object: { "box_2d": [y1,x1,y2,x2], "label": "finding name", "confidence": 0.0-1.0 }\n'
    "Return only valid JSON. No markdown or code fences.\n"
    'If no findings, return {"findings": []}.'
)

LOCALIZE_CXR_ANATOMY_PROMPT = (
    "Task: Localize anatomical regions in this chest radiograph "
    "(right lung, left lung, right hilum, left hilum, mediastinum, "
    "cardiac silhouette, right hemidiaphragm, left hemidiaphragm, "
    "trachea, spine).\n"
    "For each region, provide a bounding box in normalized coordinates (0-1000 space).\n"
    "Format: box_2d = [y_min, x_min, y_max, x_max] where (0,0) is top-left.\n"
    "Return a JSON object with key 'findings' (array of objects).\n"
    'Each object: { "box_2d": [y1,x1,y2,x2], "label": "anatomical region", "confidence": 0.0-1.0 }\n'
    "Return only valid JSON. No markdown or code fences."
)

CXR_MODALITIES = {"CR", "DX", "CXR"}


class UnsupportedModalityError(RuntimeError):
    """Raised when a localization request targets a non-CXR modality."""

    def __init__(self, modality: str | None) -> None:
        super().__init__(
            f"Localization is only validated for chest radiographs (CR/DX); got modality={modality!r}"
        )
        self.modality = modality


def generate_localize_findings(
    image_ref: dict[str, Any],
    model_name: str | None = None,
    *,
    mode: str = "cxr_finding",
) -> tuple[list[dict[str, Any]], str, dict[str, Any]]:
    """Run single-frame localization; returns (findings, model_version, metadata).

    ``mode`` selects the prompt:
    - ``cxr_finding`` (default): pathological findings on chest radiographs
    - ``cxr_anatomy``: anatomical region segmentation (ChestImaGenome-style)

    Both modes require a CXR-compatible modality (``CR``, ``DX``, ``CXR``).
    """
    wado_url = image_ref.get("wado_url") or image_ref.get("wadoUrl")
    if not isinstance(wado_url, str) or not wado_url.strip():
        return [], model_name or "mock-localize-0.1", {"provider": "mock", "error": "no_wado_url"}

    modality_raw = image_ref.get("series_modality") or image_ref.get("seriesModality")
    modality = (modality_raw or "").strip().upper() if isinstance(modality_raw, str) else ""
    if modality and modality not in CXR_MODALITIES:
        raise UnsupportedModalityError(modality)

    if mode not in {"cxr_finding", "cxr_anatomy"}:
        raise ValueError(f"Unsupported localize mode: {mode}")
    prompt = LOCALIZE_CXR_FINDING_PROMPT if mode == "cxr_finding" else LOCALIZE_CXR_ANATOMY_PROMPT

    image_urls = [_rewrite_image_url(wado_url.strip())]
    if not _env_flag("VLLM_ENABLED", False):
        mock_finding = {
            "box_2d": [100, 100, 300, 300],
            "label": "Mock finding (VLLM_ENABLED=false)",
            "confidence": 0.5,
        }
        return [mock_finding], model_name or "mock-localize-0.1", {"provider": "mock", "mode": mode}

    resolved_model = _vllm_model_name(model_name)
    try:
        start_time = time.monotonic()
        system_prompt, system_meta = render_prompt_with_metadata("system")
        raw_text = _vllm_chat_completion(
            prompt,
            model_name=resolved_model,
            system_prompt=system_prompt,
            image_urls=image_urls,
        )
        parsed, parse_error = _parse_json_response(raw_text)
        metadata: dict[str, Any] = {
            "schema_name": "localize_output",
            "schema_version": SCHEMA_VERSION,
        }
        findings: list[dict[str, Any]] = []

        if parsed:
            try:
                output = LocalizeOutput.model_validate(parsed)
                for f in output.findings:
                    findings.append(
                        {
                            "box_2d": f.box_2d,
                            "label": f.label,
                            "confidence": f.confidence,
                            "slice_index": f.slice_index,
                        }
                    )
                metadata["json_parsed"] = True
                metadata["json_schema_valid"] = True
            except ValidationError:
                metadata["json_parsed"] = True
                metadata["json_schema_valid"] = False
                metadata["json_error"] = "schema_validation_failed"
                raw_findings = parsed.get("findings")
                if isinstance(raw_findings, list):
                    for item in raw_findings:
                        if isinstance(item, dict) and "box_2d" in item and "label" in item:
                            box = item.get("box_2d")
                            if isinstance(box, list) and len(box) == 4:
                                findings.append(
                                    {
                                        "box_2d": [float(x) for x in box],
                                        "label": str(item.get("label", "")),
                                        "confidence": item.get("confidence"),
                                    }
                                )
        else:
            metadata["json_parsed"] = False
            metadata["json_error"] = parse_error or "no_json_object"

        latency_ms = int((time.monotonic() - start_time) * 1000)
        metadata["latency_ms"] = latency_ms
        metadata["prompt"] = {"system": system_meta, "task": f"localize.{mode}"}
        metadata["mode"] = mode
        return findings, resolved_model, {"provider": "vllm", **metadata}
    except Exception as exc:
        logger.warning("vLLM localize failed: %s", exc)
        if _env_flag("VLLM_FALLBACK_TO_MOCK", True):
            mock_finding = {
                "box_2d": [150, 150, 350, 350],
                "label": "Fallback (vLLM error)",
                "confidence": 0.3,
            }
            return (
                [mock_finding],
                model_name or "mock-localize-0.1",
                {"provider": "mock", "error": str(exc)},
            )
        raise RuntimeError("vLLM localize failed") from exc


def _build_volume_prompt(
    findings_text: str | None,
    *,
    modality: str,
    window_preset: str,
    selected_count: int,
    total_count: int,
    slice_thickness: float | None,
    pixel_spacing: list[float] | None,
) -> str:
    spacing_str = ""
    if pixel_spacing and len(pixel_spacing) >= 2:
        spacing_str = f" pixel_spacing={_format_float(pixel_spacing[0])}x{_format_float(pixel_spacing[1])}mm"
    thickness_str = ""
    if slice_thickness is not None:
        thickness_str = f" slice_thickness={_format_float(float(slice_thickness))}mm"
    return (
        f"Task: Interpret the {modality} volume below.\n"
        f"Volume: {selected_count} axial slices sampled from {total_count} total"
        f"{thickness_str}{spacing_str}, window={window_preset}.\n"
        "The slices are presented in superior→inferior order; each image is\n"
        "indexed starting at 1 (use the index for evidence_indices).\n"
        "If findings text is provided, align with it and correct only obvious conflicts.\n"
        "If findings text is empty, rely solely on the images.\n"
        "Output: 2-4 sentences summarizing the imaging findings.\n"
        "Return a JSON object with keys:\n"
        "- summary (string)\n"
        "- evidence_indices (array of integers; refer to slice indices 1..N)\n"
        "- limitations (string, optional)\n"
        "- confidence (string, optional: low|medium|high)\n"
        "Return only valid JSON. No markdown or code fences.\n\n"
        f"Findings (optional):\n{(findings_text or '').strip()}"
    )


def generate_volume_inference_summary(
    *,
    study_uid: str,
    series_uid: str,
    findings_text: str | None = None,
    max_slices: int | None = None,
    window_preset: str | None = None,
    strategy: str | None = None,
    model_name: str | None = None,
) -> tuple[str, float | None, str, dict[str, Any]]:
    """Run volume-based inference: preprocess via segmenter, then call vLLM."""
    findings_text = (findings_text or "").strip()

    if not _env_flag("VLLM_ENABLED", False):
        text, confidence = generate_inference_summary(findings_text)
        return text, confidence, model_name or "mock-medgemma-volume-0.1", {
            "provider": "mock",
            "volume_preprocess": {"skipped": True, "reason": "vllm_disabled"},
        }

    # Lazy import to avoid pulling segmenter_client into mock-only environments.
    from .segmentation_client import preprocess_for_medgemma

    try:
        preprocess = preprocess_for_medgemma(
            study_uid=study_uid,
            series_uid=series_uid,
            max_slices=max_slices,
            window_preset=window_preset,
            strategy=strategy,
        )
    except Exception as exc:
        logger.warning("Volume preprocess failed: %s", exc)
        if _env_flag("VLLM_FALLBACK_TO_MOCK", True):
            text, confidence = generate_inference_summary(findings_text)
            return (
                text,
                confidence,
                model_name or "mock-medgemma-volume-0.1",
                {"provider": "mock", "error": f"preprocess_failed: {exc}"},
            )
        raise RuntimeError(f"Volume preprocess failed: {exc}") from exc

    slices = preprocess.get("slices") or []
    if not slices:
        raise RuntimeError("Volume preprocess returned no slices")

    image_urls = [s["data_url"] for s in slices if isinstance(s, dict) and s.get("data_url")]
    resolved_model = _vllm_model_name(model_name)

    try:
        start_time = time.monotonic()
        system_prompt, system_meta = render_prompt_with_metadata("system")
        prompt_text = _build_volume_prompt(
            findings_text,
            modality=str(preprocess.get("modality", "")),
            window_preset=str(preprocess.get("window_preset", "")),
            selected_count=int(preprocess.get("selected_count", len(image_urls))),
            total_count=int(preprocess.get("total_count", len(image_urls))),
            slice_thickness=preprocess.get("slice_thickness"),
            pixel_spacing=preprocess.get("pixel_spacing"),
        )
        raw_text = _vllm_chat_completion(
            prompt_text,
            model_name=resolved_model,
            system_prompt=system_prompt,
            image_urls=image_urls,
            guided_json_schema=get_summary_schema(),
        )
        text, parse_metadata, evidence_indices, confidence_label = _parse_structured_output(
            raw_text,
            model_type=SummaryOutput,
            text_key="summary",
            schema_name="summary_output",
        )
        if _schema_strict() and not parse_metadata.get("json_schema_valid"):
            raise RuntimeError(
                f"Schema validation failed: {parse_metadata.get('json_error', 'unknown')}"
            )
        latency_ms = int((time.monotonic() - start_time) * 1000)
        confidence = _env_float("VLLM_DEFAULT_CONFIDENCE", 0.0)
        volume_metadata = {
            "modality": preprocess.get("modality"),
            "window_preset": preprocess.get("window_preset"),
            "strategy": preprocess.get("strategy"),
            "selected_count": preprocess.get("selected_count"),
            "total_count": preprocess.get("total_count"),
            "resize": preprocess.get("resize"),
            "pixel_spacing": preprocess.get("pixel_spacing"),
            "slice_thickness": preprocess.get("slice_thickness"),
        }
        json_metadata = {
            **parse_metadata,
            "prompt": {"system": system_meta, "task": "volume_summary"},
            "images_used": True,
            "volume_preprocess": volume_metadata,
        }
        if evidence_indices:
            json_metadata["evidence_indices"] = evidence_indices
        else:
            json_metadata["evidence_missing"] = True
        if confidence_label:
            json_metadata["confidence_label"] = confidence_label
        return (
            text,
            confidence,
            resolved_model,
            _compact_metadata({"provider": "vllm", "latency_ms": latency_ms, **json_metadata}),
        )
    except Exception as exc:
        logger.warning("vLLM volume inference failed: %s", exc)
        if _env_flag("VLLM_FALLBACK_TO_MOCK", True):
            text, confidence = generate_inference_summary(findings_text)
            return (
                text,
                confidence,
                model_name or "mock-medgemma-volume-0.1",
                {"provider": "mock", "error": str(exc)},
            )
        raise RuntimeError("vLLM volume inference failed") from exc


def _format_slice_manifest(slices: list[dict[str, Any]], offset: int = 0) -> str:
    """Render slice metadata as a one-line-per-slice manifest for prompts."""
    lines: list[str] = []
    for entry in slices:
        if not isinstance(entry, dict):
            continue
        idx = entry.get("index")
        if not isinstance(idx, int):
            continue
        parts = [f"{idx + offset})"]
        z_pos = entry.get("z_position")
        if isinstance(z_pos, (int, float)):
            parts.append(f"z={_format_float(float(z_pos))}")
        ino = entry.get("instance_number")
        if isinstance(ino, int):
            parts.append(f"instance={ino}")
        lines.append(" ".join(parts))
    return "\n".join(lines)


def generate_comparison_text(
    *,
    current_study_uid: str,
    current_series_uid: str,
    prior_study_uid: str,
    prior_series_uid: str,
    time_delta_days: int | None = None,
    findings_text: str | None = None,
    max_slices: int | None = None,
    window_preset: str | None = None,
    model_name: str | None = None,
) -> tuple[str, float | None, str, dict[str, Any]]:
    """Run a longitudinal comparison via two volume preprocesses (P1.A)."""
    findings_text = (findings_text or "").strip()

    if not _env_flag("VLLM_ENABLED", False):
        text, confidence = generate_inference_summary(findings_text)
        return text, confidence, model_name or "mock-medgemma-comparison-0.1", {
            "provider": "mock",
            "comparison": {"skipped": True, "reason": "vllm_disabled"},
        }

    from .segmentation_client import preprocess_for_medgemma

    try:
        current = preprocess_for_medgemma(
            study_uid=current_study_uid,
            series_uid=current_series_uid,
            max_slices=max_slices,
            window_preset=window_preset,
        )
        prior = preprocess_for_medgemma(
            study_uid=prior_study_uid,
            series_uid=prior_series_uid,
            max_slices=max_slices,
            window_preset=window_preset,
        )
    except Exception as exc:
        logger.warning("Comparison preprocess failed: %s", exc)
        if _env_flag("VLLM_FALLBACK_TO_MOCK", True):
            text, confidence = generate_inference_summary(findings_text)
            return (
                text,
                confidence,
                model_name or "mock-medgemma-comparison-0.1",
                {"provider": "mock", "error": f"preprocess_failed: {exc}"},
            )
        raise RuntimeError(f"Comparison preprocess failed: {exc}") from exc

    current_slices = current.get("slices") or []
    prior_slices = prior.get("slices") or []
    if not current_slices or not prior_slices:
        raise RuntimeError("Comparison preprocess returned empty slice list")

    current_urls = [s["data_url"] for s in current_slices if isinstance(s, dict) and s.get("data_url")]
    prior_urls = [s["data_url"] for s in prior_slices if isinstance(s, dict) and s.get("data_url")]
    image_urls = current_urls + prior_urls
    resolved_model = _vllm_model_name(model_name)

    try:
        start_time = time.monotonic()
        system_prompt, system_meta = render_prompt_with_metadata("system")
        prompt_text, prompt_meta = render_prompt_with_metadata(
            "comparison",
            {
                "findings_text": findings_text,
                "current_manifest": _format_slice_manifest(current_slices, offset=0),
                "prior_manifest": _format_slice_manifest(
                    prior_slices, offset=len(current_slices)
                ),
                "time_delta_days": str(time_delta_days) if time_delta_days is not None else "",
            },
        )
        raw_text = _vllm_chat_completion(
            prompt_text,
            model_name=resolved_model,
            system_prompt=system_prompt,
            image_urls=image_urls,
            guided_json_schema=get_comparison_schema(),
        )
        parsed, parse_error = _parse_json_response(raw_text)
        metadata: dict[str, Any] = {
            "schema_name": "comparison_output",
            "schema_version": SCHEMA_VERSION,
            "prompt": {"system": system_meta, "task": prompt_meta},
            "comparison": {
                "current_count": current.get("selected_count"),
                "prior_count": prior.get("selected_count"),
                "current_modality": current.get("modality"),
                "prior_modality": prior.get("modality"),
                "current_window_preset": current.get("window_preset"),
                "prior_window_preset": prior.get("window_preset"),
                "time_delta_days": time_delta_days,
            },
            "images_used": True,
        }
        comparison_payload: dict[str, Any] | None = None
        if parsed:
            try:
                comparison = ComparisonOutput.model_validate(parsed)
                comparison_payload = comparison.model_dump()
                metadata["json_parsed"] = True
                metadata["json_schema_valid"] = True
            except ValidationError:
                metadata["json_parsed"] = True
                metadata["json_schema_valid"] = False
                metadata["json_error"] = "schema_validation_failed"
        else:
            metadata["json_parsed"] = False
            metadata["json_error"] = parse_error or "no_json_object"

        if _schema_strict() and not metadata.get("json_schema_valid"):
            raise RuntimeError(
                f"Schema validation failed: {metadata.get('json_error', 'unknown')}"
            )

        latency_ms = int((time.monotonic() - start_time) * 1000)
        confidence = _env_float("VLLM_DEFAULT_CONFIDENCE", 0.0)
        summary_text = (
            comparison_payload.get("summary_change") if comparison_payload else raw_text
        )
        if comparison_payload:
            metadata["comparison_output"] = comparison_payload
        return (
            summary_text or raw_text,
            confidence,
            resolved_model,
            _compact_metadata({"provider": "vllm", "latency_ms": latency_ms, **metadata}),
        )
    except Exception as exc:
        logger.warning("vLLM comparison failed: %s", exc)
        if _env_flag("VLLM_FALLBACK_TO_MOCK", True):
            text, confidence = generate_inference_summary(findings_text)
            return (
                text,
                confidence,
                model_name or "mock-medgemma-comparison-0.1",
                {"provider": "mock", "error": str(exc)},
            )
        raise RuntimeError("vLLM comparison failed") from exc


async def generate_impression_stream(
    findings_text: str | None,
    *,
    image_urls: list[str] | None = None,
    image_refs: list[dict[str, Any]] | None = None,
) -> Any:
    """Async generator that yields impression text tokens via SSE.

    Each yielded value is a string token chunk. The generator falls back to
    a single-chunk mock when VLLM_ENABLED is false or vLLM is unreachable.
    Caller should use `async for token in generate_impression_stream(...)`.
    """
    findings_text = (findings_text or "").strip()
    has_images = bool(_normalize_list(image_urls))

    if not _env_flag("VLLM_ENABLED", False):
        # Mock fallback: yield the whole mock impression as a single chunk
        text, _ = generate_impression(findings_text)
        yield text
        return

    image_manifest = _build_image_manifest(image_urls, None, image_refs)
    model_name = _vllm_model_name()
    url = f"{_vllm_base_url()}/chat/completions"
    rewritten_urls = _rewrite_image_urls(image_urls)
    normalized_urls = _normalize_list(rewritten_urls)

    system_prompt, _ = render_prompt_with_metadata("system")
    prompt_text, _ = _build_impression_prompt(findings_text, image_manifest)

    if has_images:
        content: str | list[dict[str, Any]] = _build_multimodal_content(
            prompt_text, normalized_urls, []
        )
    else:
        content = prompt_text

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
        "max_tokens": _env_int("VLLM_MAX_TOKENS", 4096),
        "temperature": _env_float("VLLM_TEMPERATURE", 0.1),
        "top_p": _env_float("VLLM_TOP_P", 0.9),
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=_vllm_timeout()) as client:
            async with client.stream(
                "POST", url, json=payload, headers=_vllm_headers()
            ) as response:
                response.raise_for_status()
                async for raw_line in response.aiter_lines():
                    line = raw_line.strip()
                    if not line or not line.startswith("data:"):
                        continue
                    data_str = line[len("data:"):].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    token = delta.get("content")
                    if token:
                        yield token
    except Exception as exc:
        logger.warning("vLLM stream failed, falling back to mock: %s", exc)
        text, _ = generate_impression(findings_text)
        yield text
