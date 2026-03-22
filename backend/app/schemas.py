from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiBaseModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class ReportCreateRequest(ApiBaseModel):
    study_id: str
    patient_id: str
    status: str | None = "pending"
    findings_text: str | None = ""
    impression_text: str | None = ""
    report_id: str | None = None


class ReportFinalizeRequest(ApiBaseModel):
    approved_by: str | None = Field(default=None, alias="approvedBy")
    signature: str | None = None


class ReportUpdateRequest(ApiBaseModel):
    findings_text: str | None = None
    impression_text: str | None = None
    status: str | None = None
    actor_id: str | None = Field(default=None, alias="actorId")


class ReportResponse(ApiBaseModel):
    id: str
    study_id: str
    patient_id: str
    status: str
    findings_text: str
    impression_text: str
    created_at: str
    updated_at: str
    approved_at: str | None = None
    approved_by: str | None = None
    qa_status: str
    qa_warnings: list[str]
    inference_status: str | None = None
    inference_summary: str | None = None
    inference_confidence: float | None = None
    inference_model_version: str | None = None
    inference_job_id: str | None = None
    inference_completed_at: str | None = None


class ASRResponse(ApiBaseModel):
    text: str
    confidence: float
    timestamp: str


class ImpressionRequest(ApiBaseModel):
    report_id: str | None = None
    findings_text: str | None = None
    image_urls: list[str] | None = None
    image_paths: list[str] | None = None


class ImpressionResponse(ApiBaseModel):
    text: str
    confidence: float
    model: str
    generated_at: str
    metadata: dict[str, Any] | None = None


class QACheckRequest(ApiBaseModel):
    report_id: str | None = None
    findings_text: str | None = None
    impression_text: str | None = None


class QACheck(ApiBaseModel):
    id: str
    name: str
    status: Literal["pass", "warn", "fail"]
    message: str | None = None


class QAResponse(ApiBaseModel):
    passes: bool
    failures: list[str]
    warnings: list[str]
    quality_score: float | None = None
    checks: list[QACheck]


class ImageRef(ApiBaseModel):
    study_id: str
    series_id: str
    instance_id: str
    frame_index: int
    stack_index: int
    wado_url: str
    image_id: str | None = None
    study_date: str | None = None
    time_delta_days: int | None = None
    series_description: str | None = None
    series_modality: str | None = None
    role: Literal["current", "prior"] | None = None
    pixel_spacing: list[float] | None = None
    slice_thickness: float | None = None
    spacing_between_slices: float | None = None
    image_orientation: list[float] | None = None
    image_position: list[float] | None = None
    instance_number: int | None = None


class InferenceQueueRequest(ApiBaseModel):
    report_id: str | None = None
    study_id: str | None = None
    findings_text: str | None = None
    image_urls: list[str] | None = None
    image_paths: list[str] | None = None
    image_refs: list[ImageRef] | None = None
    requested_by: str | None = None
    model_version: str | None = None


class InferenceQueueResponse(ApiBaseModel):
    job_id: str
    status: str
    queued_at: str
    report_id: str | None = None
    study_id: str | None = None
    model_version: str


class InferenceStatusResponse(ApiBaseModel):
    job_id: str
    status: str
    queued_at: str | None = None
    started_at: str | None = None
    ended_at: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


class LocalizeRequest(ApiBaseModel):
    """Request for on-demand single-frame localization (bounding-box findings)."""

    report_id: str | None = None
    study_id: str | None = None
    image_ref: ImageRef
    requested_by: str | None = None
    model_version: str | None = None


PromptType = Literal["system", "summary", "impression"]


class PromptTemplateResponse(ApiBaseModel):
    prompt_type: PromptType = Field(alias="promptType")
    name: str
    template_text: str = Field(alias="templateText")
    version: int | None = None
    is_active: bool = Field(alias="isActive")
    variables: list[str]
    created_by: str | None = Field(default=None, alias="createdBy")
    created_at: str | None = Field(default=None, alias="createdAt")
    updated_at: str | None = Field(default=None, alias="updatedAt")
    source: Literal["db", "env", "default"]
    default_text: str = Field(alias="defaultText")
    editable: bool
    max_length: int = Field(alias="maxLength")
    allowed_variables: list[str] = Field(alias="allowedVariables")


class PromptListResponse(ApiBaseModel):
    editable: bool
    max_length: int = Field(alias="maxLength")
    allowed_variables: dict[str, list[str]] = Field(alias="allowedVariables")
    prompts: list[PromptTemplateResponse]


class PromptUpdateRequest(ApiBaseModel):
    template_text: str = Field(alias="templateText")
    name: str | None = None
    actor_id: str | None = Field(default=None, alias="actorId")


class ReportRevisionResponse(ApiBaseModel):
    id: str
    report_id: str
    findings_text: str
    impression_text: str
    changed_by: str | None = None
    changed_at: str
    change_reason: str | None = None


class AuditEventRequest(ApiBaseModel):
    event_type: str = Field(alias="eventType")
    actor_id: str | None = Field(default=None, alias="actorId")
    report_id: str | None = Field(default=None, alias="reportId")
    study_id: str | None = Field(default=None, alias="studyId")
    timestamp: str | None = None
    metadata: dict[str, Any] | None = None


class AuditEventResponse(ApiBaseModel):
    id: str
    event_type: str
    actor_id: str | None = None
    report_id: str | None = None
    study_id: str | None = None
    timestamp: str
    metadata: dict[str, Any] | None = None
