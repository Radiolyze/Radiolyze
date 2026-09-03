"""Fragments shared by the structured-output job families.

Impression, summary and volume inference each build the same metadata block
around a parsed model response and enforce the same strict-schema rule. They
were three verbatim copies before the split (#293); they are one here.
"""

from __future__ import annotations

from typing import Any

from ..inference_utils import _schema_strict


def _raise_if_schema_invalid(metadata: dict[str, Any]) -> None:
    """Reject an unvalidated model response when ``VLLM_SCHEMA_STRICT`` is set.

    Callers run this inside their ``try`` block, so a raise here lands in the
    same mock-fallback path as a transport failure.
    """
    if _schema_strict() and not metadata.get("json_schema_valid"):
        raise RuntimeError(f"Schema validation failed: {metadata.get('json_error', 'unknown')}")


def _structured_metadata(
    parse_metadata: dict[str, Any],
    *,
    system_meta: dict[str, Any],
    task: Any,
    has_images: bool,
    evidence_indices: list[int] | None,
    confidence_label: str | None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Assemble the metadata a structured-output job returns to its caller.

    ``evidence_missing`` marks the case the UI cares about: images went to the
    model and it answered without pointing at any of them.
    """
    metadata: dict[str, Any] = {
        **parse_metadata,
        "prompt": {"system": system_meta, "task": task},
        "images_used": has_images,
    }
    if extra:
        metadata.update(extra)
    if evidence_indices:
        metadata["evidence_indices"] = evidence_indices
    elif has_images:
        metadata["evidence_missing"] = True
    if confidence_label:
        metadata["confidence_label"] = confidence_label
    return metadata
