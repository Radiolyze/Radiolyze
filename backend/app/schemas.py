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


class InferenceQueueRequest(ApiBaseModel):
    report_id: str | None = None
    study_id: str | None = None
    findings_text: str | None = None
    image_urls: list[str] | None = None
    image_paths: list[str] | None = None
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
