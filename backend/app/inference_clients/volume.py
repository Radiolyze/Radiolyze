"""Volume inference: preprocess a series into slices via the segmenter, then summarize."""

from __future__ import annotations

import logging
import time
from typing import Any

from .. import vllm_client
from ..ai_schemas import SummaryOutput, get_summary_schema
from ..inference_utils import (
    _compact_metadata,
    _env_flag,
    _env_float,
    _format_float,
    _schema_strict,
)
from ..mock_logic import generate_inference_summary
from ..prompts import render_prompt_with_metadata
from ..schema_validator import _parse_structured_output

logger = logging.getLogger(__name__)


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
        spacing_str = (
            f" pixel_spacing={_format_float(pixel_spacing[0])}x{_format_float(pixel_spacing[1])}mm"
        )
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
        return (
            text,
            confidence,
            model_name or "mock-medgemma-volume-0.1",
            {
                "provider": "mock",
                "volume_preprocess": {"skipped": True, "reason": "vllm_disabled"},
            },
        )

    # Lazy import to avoid pulling segmenter_client into mock-only environments.
    from ..segmentation_client import preprocess_for_medgemma

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
    resolved_model = vllm_client._vllm_model_name(model_name)

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
        raw_text = vllm_client._vllm_chat_completion(
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
            has_images=True,
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
