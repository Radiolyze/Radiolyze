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
from ..models import InferenceJob, Report
from ..schemas import ReportCreateRequest, ReportResponse


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
    def serialize(
        report: Report, inference_job: InferenceJob | None = None
    ) -> ReportResponse:
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

    def list(
        self, *, status: str | None = None, limit: int = 50, offset: int = 0
    ) -> list[Report]:
        query = self.db.query(Report)
        if status:
            query = query.filter(Report.status == status)
        return query.order_by(Report.created_at.desc()).offset(offset).limit(limit).all()

    def list_by_patient(
        self, patient_id: str, *, limit: int = 20, offset: int = 0
    ) -> list[Report]:
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
