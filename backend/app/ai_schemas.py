from __future__ import annotations

from typing import Any, Literal

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    ValidationInfo,
    field_validator,
    model_validator,
)

# 1.3 adds the optional `category` to FindingBoxOutput (#298). Bumped rather
# than left alone because the version is stamped into every stored job's
# metadata, and it is the only thing that separates a finding with no category
# because the field did not exist yet from one the model declined to classify.
SCHEMA_VERSION = "1.3"


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


FindingCategory = Literal["pathological", "anatomical", "other"]

FINDING_CATEGORIES: tuple[str, ...] = ("pathological", "anatomical", "other")


def normalize_finding_category(value: Any) -> str | None:
    """Map a model-supplied finding category onto the known set; unknown -> ``None``.

    Deliberately lenient. The category is an extra hint on a finding that
    already carries a box and a label, and ``LocalizeOutput`` drops a finding
    whose validation fails -- so a value outside the set costs the hint, not the
    box. The consumer treats ``None`` as "unclassified" and falls back.
    """
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    return normalized if normalized in FINDING_CATEGORIES else None


class BaseAIOutput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class SummaryOutput(BaseAIOutput):
    summary: str
    evidence_indices: list[int] | None = Field(
        default=None,
        validation_alias=AliasChoices("evidence_indices", "evidenceIndices"),
    )
    limitations: str | None = None
    confidence: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _require_evidence_when_images(cls, data: Any, info: ValidationInfo) -> Any:
        context = info.context if info else None
        if context and context.get("has_images") and not data.get("evidence_indices"):
            raise ValueError(
                "evidence_indices required when image_refs are present (EU AI Act Art. 12)"
            )
        return data

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

    @field_validator("confidence", mode="before")
    @classmethod
    def _coerce_confidence(cls, value: Any) -> str | None:
        return _normalize_text(value)


class FindingBoxOutput(BaseAIOutput):
    """Single finding with bounding box (MedGemma format: y_min, x_min, y_max, x_max in 0-1000 space)."""

    box_2d: list[float]
    label: str
    confidence: float | None = None
    #: What the model says the finding *is* -- read by the viewer overlay to
    #: colour the box. Optional: findings stored before this field existed carry
    #: no category, and the overlay falls back to matching on the label there.
    category: FindingCategory | None = None
    slice_index: int | None = Field(
        default=None,
        validation_alias=AliasChoices("slice_index", "sliceIndex"),
    )

    @field_validator("box_2d")
    @classmethod
    def _validate_box(cls, value: Any) -> list[float]:
        if not isinstance(value, list) or len(value) != 4:
            raise ValueError("box_2d must be a list of 4 numbers")
        return [float(v) for v in value]

    @field_validator("category", mode="before")
    @classmethod
    def _coerce_category(cls, value: Any) -> str | None:
        return normalize_finding_category(value)


class ChangeItem(BaseAIOutput):
    """One longitudinal finding with directional status."""

    finding: str
    status: Literal["new", "progressed", "stable", "regressed", "resolved"]
    evidence_indices_current: list[int] | None = Field(
        default=None,
        validation_alias=AliasChoices("evidence_indices_current", "evidenceIndicesCurrent"),
    )
    evidence_indices_prior: list[int] | None = Field(
        default=None,
        validation_alias=AliasChoices("evidence_indices_prior", "evidenceIndicesPrior"),
    )
    quantitative_change: str | None = Field(
        default=None,
        validation_alias=AliasChoices("quantitative_change", "quantitativeChange"),
    )

    @field_validator("evidence_indices_current", "evidence_indices_prior", mode="before")
    @classmethod
    def _coerce_indices(cls, value: Any) -> list[int] | None:
        return _normalize_indices(value)


class ComparisonOutput(BaseAIOutput):
    """Structured longitudinal comparison output (P1.A)."""

    summary_change: str
    changes: list[ChangeItem] = Field(default_factory=list)
    overall_trend: Literal["improved", "worsened", "mixed", "stable"]
    confidence: str | None = None

    @field_validator("summary_change")
    @classmethod
    def _validate_summary_change(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("summary_change must be non-empty")
        return normalized

    @field_validator("changes", mode="before")
    @classmethod
    def _coerce_changes(cls, value: Any) -> list[ChangeItem]:
        if not isinstance(value, list):
            return []
        result: list[ChangeItem] = []
        for item in value:
            if isinstance(item, dict):
                try:
                    result.append(ChangeItem.model_validate(item))
                except Exception:
                    continue
        return result


class LocalizeOutput(BaseAIOutput):
    """Output for single-frame localization (bounding-box findings)."""

    findings: list[FindingBoxOutput] = Field(default_factory=list)

    @field_validator("findings", mode="before")
    @classmethod
    def _coerce_findings(cls, value: Any) -> list[FindingBoxOutput]:
        if not isinstance(value, list):
            return []
        result: list[FindingBoxOutput] = []
        for item in value:
            if isinstance(item, dict):
                try:
                    result.append(FindingBoxOutput.model_validate(item))
                except Exception:
                    continue
        return result


class ImpressionOutput(BaseAIOutput):
    impression: str
    comparison: str | None = None
    evidence_indices: list[int] | None = Field(
        default=None,
        validation_alias=AliasChoices("evidence_indices", "evidenceIndices"),
    )
    confidence: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _require_evidence_when_images(cls, data: Any, info: ValidationInfo) -> Any:
        context = info.context if info else None
        if context and context.get("has_images") and not data.get("evidence_indices"):
            raise ValueError(
                "evidence_indices required when image_refs are present (EU AI Act Art. 12)"
            )
        return data

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


# ---------------------------------------------------------------------------
# JSON Schema exports (for vLLM guided_json and API documentation)
# ---------------------------------------------------------------------------


def get_summary_schema() -> dict[str, Any]:
    """Return the JSON Schema for SummaryOutput (used by vLLM guided_json)."""
    return SummaryOutput.model_json_schema()


def get_impression_schema() -> dict[str, Any]:
    """Return the JSON Schema for ImpressionOutput."""
    return ImpressionOutput.model_json_schema()


def get_localize_schema() -> dict[str, Any]:
    """Return the JSON Schema for LocalizeOutput."""
    return LocalizeOutput.model_json_schema()


def get_comparison_schema() -> dict[str, Any]:
    """Return the JSON Schema for ComparisonOutput (P1.A)."""
    return ComparisonOutput.model_json_schema()


def get_all_schemas() -> dict[str, Any]:
    """Return all output schemas keyed by name, plus schema version."""
    return {
        "schema_version": SCHEMA_VERSION,
        "schemas": {
            "summary_output": get_summary_schema(),
            "impression_output": get_impression_schema(),
            "localize_output": get_localize_schema(),
            "comparison_output": get_comparison_schema(),
        },
    }
