"""Report data-access, creation and serialization logic.

Centralizes the report read/create/serialize operations that previously lived
as free functions in ``app.api.reports``. HTTP concerns (status codes, ETag
headers, WebSocket broadcasts) remain in the route handlers, which delegate the
data work to this service.
"""

from __future__ import annotations

import hashlib
import uuid

from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..mock_logic import utc_now
from ..models import InferenceJob, Report, ReportRevision
from ..schemas import (
    ReportCreateRequest,
    ReportFinalizeRequest,
    ReportResponse,
    ReportUpdateRequest,
)
from .exceptions import ConflictError, NotFoundError


class ReportService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Inference-job lookups
    # ------------------------------------------------------------------
    def get_latest_inference_job(self, report_id: str | None) -> InferenceJob | None:
        if not report_id:
            return None
        return (
            self.db.query(InferenceJob)
            .filter(InferenceJob.report_id == report_id)
            .order_by(InferenceJob.queued_at.desc())
            .first()
        )

    def get_latest_inference_jobs(self, report_ids: list[str]) -> dict[str, InferenceJob]:
        """Return the most recent InferenceJob per report id in a single query.

        Avoids the N+1 pattern of one query per row when serializing lists.
        """
        if not report_ids:
            return {}
        jobs = (
            self.db.query(InferenceJob)
            .filter(InferenceJob.report_id.in_(report_ids))
            .order_by(InferenceJob.queued_at.desc())
            .all()
        )
        latest: dict[str, InferenceJob] = {}
        for job in jobs:
            # Rows arrive newest-first, so the first one seen per report wins.
            if job.report_id and job.report_id not in latest:
                latest[job.report_id] = job
        return latest

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------
    @staticmethod
    def serialize(report: Report, inference_job: InferenceJob | None = None) -> ReportResponse:
        return ReportResponse(
            id=report.id,
            study_id=report.study_id,
            patient_id=report.patient_id,
            status=report.status,
            findings_text=report.findings_text,
            impression_text=report.impression_text,
            created_at=report.created_at,
            updated_at=report.updated_at,
            approved_at=report.approved_at,
            approved_by=report.approved_by,
            qa_status=report.qa_status,
            qa_warnings=report.qa_warnings or [],
            structured_data=getattr(report, "structured_data", None),
            inference_status=inference_job.status if inference_job else None,
            inference_summary=inference_job.summary_text if inference_job else None,
            inference_confidence=inference_job.confidence if inference_job else None,
            inference_model_version=inference_job.model_version if inference_job else None,
            inference_job_id=inference_job.id if inference_job else None,
            inference_completed_at=inference_job.completed_at if inference_job else None,
        )

    def serialize_one(self, report: Report) -> ReportResponse:
        """Serialize a single report, loading its latest inference job."""
        return self.serialize(report, self.get_latest_inference_job(report.id))

    def serialize_many(self, reports: list[Report]) -> list[ReportResponse]:
        """Serialize a list of reports, batch-loading their latest inference jobs."""
        latest = self.get_latest_inference_jobs([r.id for r in reports])
        return [self.serialize(r, latest.get(r.id)) for r in reports]

    @staticmethod
    def compute_etag(report: Report) -> str:
        """Compute an ETag from the report's updated_at timestamp."""
        return hashlib.sha256(report.updated_at.encode()).hexdigest()[:16]

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------
    def get(self, report_id: str) -> Report | None:
        return self.db.get(Report, report_id)

    def list(self, *, status: str | None = None, limit: int = 50, offset: int = 0) -> list[Report]:
        query = self.db.query(Report)
        if status:
            query = query.filter(Report.status == status)
        return query.order_by(Report.created_at.desc()).offset(offset).limit(limit).all()

    def list_by_patient(self, patient_id: str, *, limit: int = 20, offset: int = 0) -> list[Report]:
        return (
            self.db.query(Report)
            .filter(Report.patient_id == patient_id)
            .order_by(Report.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------
    def create(self, payload: ReportCreateRequest, *, actor_id: str = "system") -> Report:
        report_id = payload.report_id or str(uuid.uuid4())
        now = utc_now()

        report = Report(
            id=report_id,
            study_id=payload.study_id,
            patient_id=payload.patient_id,
            status=payload.status or "pending",
            findings_text=payload.findings_text or "",
            impression_text=payload.impression_text or "",
            created_at=now,
            updated_at=now,
            qa_status="pending",
            qa_warnings=[],
        )

        self.db.add(report)
        add_audit_event(
            self.db,
            event_type="report_created",
            actor_id=actor_id,
            report_id=report_id,
            study_id=payload.study_id,
            metadata={"status": report.status},
            timestamp=now,
            source="api",
        )
        self.db.commit()
        self.db.refresh(report)
        return report

    def update(
        self,
        report_id: str,
        payload: ReportUpdateRequest,
        *,
        actor_id: str | None,
        if_match: str | None = None,
    ) -> tuple[Report, bool, str | None]:
        """Apply a partial update, recording a revision snapshot and audit event.

        Returns the updated report along with whether a status broadcast is
        warranted and the report's (possibly unchanged) qa_status, mirroring
        what the WebSocket route handler needs without depending on FastAPI.
        """
        report = self.db.get(Report, report_id)
        if not report:
            raise NotFoundError(f"Report {report_id} not found")

        if if_match:
            current_etag = f'"{self.compute_etag(report)}"'
            if if_match.strip('" ') != current_etag.strip('" '):
                raise ConflictError("Report was modified by another user")

        old_findings = report.findings_text
        old_impression = report.impression_text

        updated_fields: list[str] = []
        if payload.findings_text is not None:
            report.findings_text = payload.findings_text
            updated_fields.append("findings_text")
        if payload.impression_text is not None:
            report.impression_text = payload.impression_text
            updated_fields.append("impression_text")
        if payload.status is not None:
            report.status = payload.status
            updated_fields.append("status")
        if payload.structured_data is not None:
            report.structured_data = payload.structured_data
            updated_fields.append("structured_data")

        should_broadcast = False
        qa_status: str | None = None
        if updated_fields:
            now = utc_now()

            revision = ReportRevision(
                report_id=report_id,
                findings_text=old_findings,
                impression_text=old_impression,
                changed_by=actor_id,
                changed_at=now,
            )
            self.db.add(revision)

            report.updated_at = now
            if payload.status is None and report.status in {"pending", "in_progress"}:
                report.status = "draft"

            event_type = "report_updated"
            if "findings_text" in updated_fields:
                event_type = "findings_saved"
            elif "impression_text" in updated_fields:
                event_type = "report_amended"

            add_audit_event(
                self.db,
                event_type=event_type,
                actor_id=actor_id,
                report_id=report_id,
                study_id=report.study_id,
                metadata={"updated_fields": updated_fields},
                timestamp=now,
                source="api",
            )
            self.db.commit()
            self.db.refresh(report)

            if payload.status is None and report.status in {"draft", "pending", "in_progress"}:
                should_broadcast = True
                qa_status = report.qa_status

        return report, should_broadcast, qa_status

    def finalize(self, report_id: str, payload: ReportFinalizeRequest) -> Report:
        """Mark a report finalized, stamping approval metadata and an audit event."""
        report = self.db.get(Report, report_id)
        if not report:
            raise NotFoundError(f"Report {report_id} not found")
        if report.status == "finalized":
            raise ConflictError("Report already finalized")

        now = utc_now()
        approver = payload.approved_by or payload.signature
        report.status = "finalized"
        report.approved_at = now
        report.approved_by = approver
        report.updated_at = now

        add_audit_event(
            self.db,
            event_type="report_approved",
            actor_id=approver,
            report_id=report_id,
            study_id=report.study_id,
            metadata={"signature": approver} if approver else None,
            timestamp=now,
            source="api",
        )
        self.db.commit()
        self.db.refresh(report)
        return report
