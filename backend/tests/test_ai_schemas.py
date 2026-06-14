"""Tests for evidence_indices validation in AI output schemas (EU AI Act Art. 12)."""

import pytest
from pydantic import ValidationError

from app.ai_schemas import ImpressionOutput, SummaryOutput


@pytest.mark.parametrize("schema_cls,required_field,valid_data", [
    (
        SummaryOutput,
        "summary",
        {"summary": "No acute findings.", "evidence_indices": [1, 2]},
    ),
    (
        ImpressionOutput,
        "impression",
        {"impression": "No acute findings.", "evidence_indices": [1, 2]},
    ),
])
def test_evidence_indices_required_when_images_present(schema_cls, required_field, valid_data):
    """Raises ValidationError when has_images=True but evidence_indices is absent."""
    payload = {required_field: "No acute findings."}
    with pytest.raises(ValidationError, match="evidence_indices required"):
        schema_cls.model_validate(payload, context={"has_images": True})


@pytest.mark.parametrize("schema_cls,valid_data", [
    (
        SummaryOutput,
        {"summary": "Bilateral infiltrates.", "evidence_indices": [1, 3]},
    ),
    (
        ImpressionOutput,
        {"impression": "Bilateral infiltrates.", "evidence_indices": [1, 3]},
    ),
])
def test_evidence_indices_accepted_with_images(schema_cls, valid_data):
    """No error when has_images=True and evidence_indices are provided."""
    output = schema_cls.model_validate(valid_data, context={"has_images": True})
    assert output.evidence_indices == [1, 3]


@pytest.mark.parametrize("schema_cls,payload", [
    (SummaryOutput, {"summary": "Normal study."}),
    (ImpressionOutput, {"impression": "Normal study."}),
])
def test_evidence_indices_optional_without_images(schema_cls, payload):
    """No error when has_images=False (or no context) and evidence_indices is absent."""
    output = schema_cls.model_validate(payload, context={"has_images": False})
    assert output.evidence_indices is None

    output_no_ctx = schema_cls.model_validate(payload)
    assert output_no_ctx.evidence_indices is None
