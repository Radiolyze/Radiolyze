"""Free-text inference summary over findings text and optional single frames."""

from __future__ import annotations

import logging
import time
from typing import Any

from .. import vllm_client
from ..ai_schemas import SummaryOutput, get_summary_schema
from ..image_encoder import _build_image_manifest
from ..inference_utils import _compact_metadata, _env_flag, _env_float, _normalize_list
from ..mock_logic import generate_inference_summary
from ..prompts import render_prompt_with_metadata
from ..schema_validator import _parse_structured_output
from ._common import _raise_if_schema_invalid, _structured_metadata

logger = logging.getLogger(__name__)


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
    resolved_model = vllm_client._vllm_model_name(model_name)
    try:
        start_time = time.monotonic()
        system_prompt, system_meta = render_prompt_with_metadata("system")
        prompt_text, prompt_meta = _build_summary_prompt(findings_text, image_manifest)
        raw_text = vllm_client._vllm_chat_completion(
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
            has_images=has_images,
        )
        _raise_if_schema_invalid(parse_metadata)
        latency_ms = int((time.monotonic() - start_time) * 1000)
        confidence = _env_float("VLLM_DEFAULT_CONFIDENCE", 0.0)
        json_metadata = _structured_metadata(
            parse_metadata,
            system_meta=system_meta,
            task=prompt_meta,
            has_images=has_images,
            evidence_indices=evidence_indices,
            confidence_label=confidence_label,
        )
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
