import uuid

from sqlalchemy import JSON, Boolean, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def _new_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    username: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False, default="radiologist")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    study_id: Mapped[str] = mapped_column(String, nullable=False)
    patient_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    findings_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    impression_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)
    approved_at: Mapped[str | None] = mapped_column(String, nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String, nullable=True)
    qa_status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    qa_warnings: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    # Structured data from field-based reporting templates (JSON key-value pairs)
    structured_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Orthanc URL of the archived DICOM SR object (set after successful STOW-RS store)
    dicom_sr_orthanc_url: Mapped[str | None] = mapped_column(String, nullable=True)


class ReportRevision(Base):
    __tablename__ = "report_revisions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    report_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    findings_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    impression_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    changed_by: Mapped[str | None] = mapped_column(String, nullable=True)
    changed_at: Mapped[str] = mapped_column(String, nullable=False)
    change_reason: Mapped[str | None] = mapped_column(String, nullable=True)


class QACheckResult(Base):
    __tablename__ = "qa_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    report_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    checks: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    warnings: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    failures: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    quality_score: Mapped[float | None] = mapped_column(nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class QARule(Base):
    __tablename__ = "qa_rules"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    rule_type: Mapped[str] = mapped_column(String, nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    severity: Mapped[str] = mapped_column(String, nullable=False, default="warn")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String, nullable=True)
    report_id: Mapped[str | None] = mapped_column(String, nullable=True)
    study_id: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[str] = mapped_column(String, nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)


class InferenceJob(Base):
    __tablename__ = "inference_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    report_id: Mapped[str | None] = mapped_column(String, nullable=True)
    study_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False)
    model_version: Mapped[str] = mapped_column(String, nullable=False)
    input_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    queued_at: Mapped[str] = mapped_column(String, nullable=False)
    started_at: Mapped[str | None] = mapped_column(String, nullable=True)
    completed_at: Mapped[str | None] = mapped_column(String, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)


class CriticalFindingAlert(Base):
    """Tracks critical/urgent findings that require immediate communication."""

    __tablename__ = "critical_finding_alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    report_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    finding_type: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False, default="critical")
    matched_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    notified_at: Mapped[str] = mapped_column(String, nullable=False)
    acknowledged_by: Mapped[str | None] = mapped_column(String, nullable=True)
    acknowledged_at: Mapped[str | None] = mapped_column(String, nullable=True)


class PeerReview(Base):
    """Peer review / second opinion requests for reports."""

    __tablename__ = "peer_reviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    report_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    requested_by: Mapped[str] = mapped_column(String, nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(String, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="requested")
    decision: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    completed_at: Mapped[str | None] = mapped_column(String, nullable=True)


class DriftSnapshot(Base):
    __tablename__ = "drift_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    window_days: Mapped[int] = mapped_column(Integer, nullable=False)
    baseline_days: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    prompt_type: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    template_text: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)
    # JSON Schema for structured reporting fields (optional)
    fields_schema: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Modality filter (e.g. "CT", "MR", "CR") for template selection
    modality: Mapped[str | None] = mapped_column(String, nullable=True)
    # Body region filter (e.g. "Thorax", "Abdomen", "Head")
    body_region: Mapped[str | None] = mapped_column(String, nullable=True)


class Guideline(Base):
    """Institutional guidelines and imaging standards for radiologists.

    Supports full-text search via PostgreSQL's ``tsvector`` trigram index or,
    when running on SQLite (tests), via a simple LIKE query fallback.
    """

    __tablename__ = "guidelines"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    title: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False, default="general")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    # Comma-separated tags/keywords for FTS boosting
    keywords: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class Annotation(Base):
    """Training annotations for Radiolyze Fine-Tuning."""

    __tablename__ = "annotations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    study_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    series_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    instance_id: Mapped[str] = mapped_column(String, nullable=False)
    frame_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Tool and geometry
    tool_type: Mapped[str] = mapped_column(String, nullable=False)
    geometry_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Classification
    label: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    severity: Mapped[str | None] = mapped_column(String, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Metadata
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str | None] = mapped_column(String, nullable=True)
    verified_by: Mapped[str | None] = mapped_column(String, nullable=True)
    verified_at: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # DICOM context
    anatomical_region: Mapped[str | None] = mapped_column(String, nullable=True)
    laterality: Mapped[str | None] = mapped_column(String, nullable=True)

    # Cornerstone reference
    cornerstone_annotation_uid: Mapped[str | None] = mapped_column(String, nullable=True)
