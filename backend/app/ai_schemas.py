from __future__ import annotations

from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

SCHEMA_VERSION = "1.0"

# MedGemma bounding box coordinate range (normalized 0-1000)
_BOX_COORD_MIN = 0
_BOX_COORD_MAX = 1000


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


def _coerce_box_2d(value: Any) -> list[int]:
    """Validate and coerce box_2d to a list of 4 integers in [0, 1000]."""
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        raise ValueError("box_2d must be a list of exactly 4 integers")
    result: list[int] = []
    for i, coord in enumerate(value):
        if isinstance(coord, bool):
            raise ValueError(f"box_2d[{i}] must be numeric, not bool")
        if isinstance(coord, float):
            if not coord.is_integer():
                raise ValueError(f"box_2d[{i}] must be an integer, got float {coord}")
            coord = int(coord)
        elif isinstance(coord, str):
            try:
                coord = int(coord.strip())
            except ValueError:
                raise ValueError(f"box_2d[{i}] cannot be parsed as integer: {coord!r}")
        elif not isinstance(coord, int):
            raise ValueError(f"box_2d[{i}] must be numeric, got {type(coord).__name__}")
        if not (_BOX_COORD_MIN <= coord <= _BOX_COORD_MAX):
            raise ValueError(f"box_2d[{i}] must be in [{_BOX_COORD_MIN}, {_BOX_COORD_MAX}], got {coord}")
        result.append(coord)
    y_min, x_min, y_max, x_max = result
    if y_min > y_max:
        raise ValueError(f"box_2d y_min ({y_min}) must be <= y_max ({y_max})")
    if x_min > x_max:
        raise ValueError(f"box_2d x_min ({x_min}) must be <= x_max ({x_max})")
    return result


def _coerce_finding_confidence(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        clamped = max(0.0, min(1.0, float(value)))
        return round(clamped, 4)
    if isinstance(value, str):
        try:
            clamped = max(0.0, min(1.0, float(value.strip())))
            return round(clamped, 4)
        except ValueError:
            return None
    return None


class FindingBox(BaseModel):
    """A single AI-detected finding with its bounding box.

    Coordinates use MedGemma's normalized 0-1000 space with top-left origin:
    box_2d = [y_min, x_min, y_max, x_max]
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    box_2d: list[int] = Field(
        description="[y_min, x_min, y_max, x_max] normalized 0-1000"
    )
    label: str
    confidence: float | None = None

    @field_validator("box_2d", mode="before")
    @classmethod
    def _validate_box(cls, value: Any) -> list[int]:
        return _coerce_box_2d(value)

    @field_validator("label", mode="before")
    @classmethod
    def _validate_label(cls, value: Any) -> str:
        if not isinstance(value, str):
            raise ValueError("label must be a string")
        normalized = value.strip()
        if not normalized:
            raise ValueError("label must not be empty")
        return normalized

    @field_validator("confidence", mode="before")
    @classmethod
    def _validate_confidence(cls, value: Any) -> float | None:
        return _coerce_finding_confidence(value)


class LocalizationOutput(BaseModel):
    """Structured output for MedGemma anatomical/pathological localization.

    The model returns a list of findings, each with a bounding box in
    normalized 0-1000 coordinates ([y_min, x_min, y_max, x_max]).
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    findings: list[FindingBox] = Field(default_factory=list)
    image_index: int | None = Field(
        default=None,
        description="1-based index into image manifest this result refers to",
        validation_alias=AliasChoices("image_index", "imageIndex"),
    )

    @field_validator("findings", mode="before")
    @classmethod
    def _validate_findings(cls, value: Any) -> list[Any]:
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("findings must be a list")
        return value
