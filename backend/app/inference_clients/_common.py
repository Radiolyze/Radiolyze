"""Helpers shared by more than one inference task family.

Only things that were genuinely duplicated across the task modules belong
here -- this is not a dumping ground for anything that has no other home.
"""

from __future__ import annotations

from typing import Any

from ..inference_utils import _schema_strict


def _raise_if_schema_invalid(metadata: dict[str, Any]) -> None:
    """Fail the request when strict schema mode is on and validation did not pass.

    ``VLLM_SCHEMA_STRICT`` turns a model answer that does not match the declared
    schema into an error instead of a best-effort parse. The caller decides what
    happens next -- every task family catches this and falls back to the mock
    when ``VLLM_FALLBACK_TO_MOCK`` is set.
    """
    if _schema_strict() and not metadata.get("json_schema_valid"):
        raise RuntimeError(f"Schema validation failed: {metadata.get('json_error', 'unknown')}")


def _evidence_metadata(
    parse_metadata: dict[str, Any],
    *,
    system_meta: dict[str, Any],
    task_meta: Any,
    evidence_indices: list[int] | None,
    confidence_label: str | None,
    has_images: bool,
) -> dict[str, Any]:
    """Assemble the prompt/evidence half of a job's stored metadata.

    ``evidence_missing`` marks the case that matters clinically: images went to
    the model and it answered without pointing at any of them. A text-only
    request has nothing to point at, so it is not flagged.
    """
    metadata: dict[str, Any] = {
        **parse_metadata,
        "prompt": {"system": system_meta, "task": task_meta},
        "images_used": has_images,
    }
    if evidence_indices:
        metadata["evidence_indices"] = evidence_indices
    elif has_images:
        metadata["evidence_missing"] = True
    if confidence_label:
        metadata["confidence_label"] = confidence_label
    return metadata
