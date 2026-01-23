from __future__ import annotations

from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


def _normalize_indices(value: Any) -> list[int] | None:
    if value is None:
        return None
    if not isinstance(value, list):
        return None
    indices: list[int] = []
    for entry in value:
        if isinstance(entry, bool):
            continue
        if isinstance(entry, int):
            parsed = entry
        elif isinstance(entry, float) and entry.is_integer():
            parsed = int(entry)
        elif isinstance(entry, str):
            try:
                parsed = int(entry.strip())
            except ValueError:
                continue
        else:
            continue
        if parsed > 0:
            indices.append(parsed)
    return indices or None


def _normalize_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


class BaseAIOutput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class SummaryOutput(BaseAIOutput):
    summary: str
    evidence_indices: list[int] | None = Field(
        default=None,
        validation_alias=AliasChoices("evidence_indices", "evidenceIndices"),
    )
    limitations: str | None = None

    @field_validator("summary")
    @classmethod
    def _validate_summary(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("summary must be non-empty")
        return normalized

    @field_validator("evidence_indices", mode="before")
    @classmethod
    def _coerce_indices(cls, value: Any) -> list[int] | None:
        return _normalize_indices(value)

    @field_validator("limitations", mode="before")
    @classmethod
    def _coerce_limitations(cls, value: Any) -> str | None:
        return _normalize_text(value)


class ImpressionOutput(BaseAIOutput):
    impression: str
    comparison: str | None = None
    evidence_indices: list[int] | None = Field(
        default=None,
        validation_alias=AliasChoices("evidence_indices", "evidenceIndices"),
    )
    confidence: str | None = None

    @field_validator("impression")
    @classmethod
    def _validate_impression(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("impression must be non-empty")
        return normalized

    @field_validator("comparison", mode="before")
    @classmethod
    def _coerce_comparison(cls, value: Any) -> str | None:
        return _normalize_text(value)

    @field_validator("evidence_indices", mode="before")
    @classmethod
    def _coerce_indices(cls, value: Any) -> list[int] | None:
        return _normalize_indices(value)

    @field_validator("confidence", mode="before")
    @classmethod
    def _coerce_confidence(cls, value: Any) -> str | None:
        return _normalize_text(value)
