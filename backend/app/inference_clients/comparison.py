"""Longitudinal comparison of a current series against a prior one (P1.A)."""

from __future__ import annotations

import logging
import time
from typing import Any

from pydantic import ValidationError

from .. import vllm_client
from ..ai_schemas import SCHEMA_VERSION, ComparisonOutput, get_comparison_schema
from ..inference_utils import (
    _compact_metadata,
    _env_flag,
    _env_float,
    _format_float,
    _schema_strict,
)
from ..mock_logic import generate_inference_summary
from ..prompts import render_prompt_with_metadata
from ..schema_validator import _parse_json_response

logger = logging.getLogger(__name__)


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
        return (
            text,
            confidence,
            model_name or "mock-medgemma-comparison-0.1",
            {
                "provider": "mock",
                "comparison": {"skipped": True, "reason": "vllm_disabled"},
            },
        )

    from ..segmentation_client import preprocess_for_medgemma

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

    current_urls = [
        s["data_url"] for s in current_slices if isinstance(s, dict) and s.get("data_url")
    ]
    prior_urls = [s["data_url"] for s in prior_slices if isinstance(s, dict) and s.get("data_url")]
    image_urls = current_urls + prior_urls
    resolved_model = vllm_client._vllm_model_name(model_name)

    try:
        start_time = time.monotonic()
        system_prompt, system_meta = render_prompt_with_metadata("system")
        prompt_text, prompt_meta = render_prompt_with_metadata(
            "comparison",
            {
                "findings_text": findings_text,
                "current_manifest": _format_slice_manifest(current_slices, offset=0),
                "prior_manifest": _format_slice_manifest(prior_slices, offset=len(current_slices)),
                "time_delta_days": str(time_delta_days) if time_delta_days is not None else "",
            },
        )
        raw_text = vllm_client._vllm_chat_completion(
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
            raise RuntimeError(f"Schema validation failed: {metadata.get('json_error', 'unknown')}")

        latency_ms = int((time.monotonic() - start_time) * 1000)
        confidence = _env_float("VLLM_DEFAULT_CONFIDENCE", 0.0)
        summary_text = comparison_payload.get("summary_change") if comparison_payload else raw_text
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
