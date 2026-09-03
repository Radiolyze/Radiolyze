"""Single-frame localization of findings and anatomy on chest radiographs."""

from __future__ import annotations

import logging
import time
from typing import Any

from pydantic import ValidationError

from .. import vllm_client
from ..ai_schemas import SCHEMA_VERSION, LocalizeOutput
from ..image_encoder import _rewrite_image_url
from ..inference_utils import _env_flag
from ..prompts import render_prompt_with_metadata
from ..schema_validator import _parse_json_response

logger = logging.getLogger(__name__)

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

    resolved_model = vllm_client._vllm_model_name(model_name)
    try:
        start_time = time.monotonic()
        system_prompt, system_meta = render_prompt_with_metadata("system")
        raw_text = vllm_client._vllm_chat_completion(
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
