"""Parsing and schema validation of vLLM JSON responses."""

from __future__ import annotations

import json
from typing import Any

from pydantic import ValidationError

from .ai_schemas import SCHEMA_VERSION, ImpressionOutput, SummaryOutput


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
