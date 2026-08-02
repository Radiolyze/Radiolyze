"""Inference job enqueuing.

Encapsulates the shared "tail" of the inference queue endpoints: enqueue the
RQ task, persist the queued InferenceJob row, write the audit event and bump
the owning report's status. The route handlers keep request validation, hash
computation, payload assembly and the (async) WebSocket broadcast.
"""

from __future__ import annotations

import os
from collections.abc import Callable
from datetime import datetime
from typing import Any

from rq.exceptions import NoSuchJobError
from rq.job import Job
from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..models import InferenceJob, Report
from ..queue import default_retry, get_queue, get_redis
from ..schemas import InferenceQueueResponse


class InferenceService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------
    @staticmethod
    def job_timeout() -> int:
        return int(os.getenv("INFERENCE_JOB_TIMEOUT", "600"))

    @staticmethod
    def result_ttl() -> int:
        return int(os.getenv("INFERENCE_RESULT_TTL", "3600"))

    @staticmethod
    def model_version() -> str:
        return (
            os.getenv("INFERENCE_MODEL_VERSION")
            or os.getenv("VLLM_MODEL_NAME")
            or "mock-medgemma-0.1"
        )

    # ------------------------------------------------------------------
    # Idempotency
    # ------------------------------------------------------------------
    def find_active_duplicate(
        self,
        *,
        input_hash: str | None,
        report_id: str | None,
        study_id: str | None,
    ) -> Job | None:
        """Return the in-flight RQ job for an identical, still-running request.

        Resubmitting the exact same inference request (double-click, client
        retry) while the original is still queued/started would otherwise
        enqueue a second job and pay for a second LLM call. Dedup is
        best-effort (a race between two near-simultaneous requests can still
        create two jobs) rather than relying on distributed locking.
        """
        if not input_hash:
            return None
        query = self.db.query(InferenceJob).filter(
            InferenceJob.input_hash == input_hash,
            InferenceJob.status.in_(("queued", "started")),
        )
        if report_id:
            query = query.filter(InferenceJob.report_id == report_id)
        if study_id:
            query = query.filter(InferenceJob.study_id == study_id)
        existing = query.order_by(InferenceJob.queued_at.desc()).first()
        if not existing:
            return None
        try:
            return Job.fetch(existing.id, connection=get_redis())
        except NoSuchJobError:
            # DB row is stale (e.g. the RQ job's bookkeeping key expired) -
            # fall through and enqueue a fresh job.
            return None

    # ------------------------------------------------------------------
    # Enqueue
    # ------------------------------------------------------------------
    def enqueue(
        self,
        task_fn: Callable[..., Any],
        job_payload: dict[str, Any],
        *,
        job_id: str,
        report: Report | None,
        report_id: str | None,
        study_id: str | None,
        requested_by: str,
        model_version: str,
        input_hash: str | None,
        queued_at: datetime,
        job_metadata: dict[str, Any],
        audit_event_type: str,
        audit_metadata: dict[str, Any],
    ) -> Job:
        """Enqueue a task, persist the queued job row + audit event, and bump
        the report status. Returns the enqueued RQ job (or a duplicate
        in-flight job with the same input hash, see ``find_active_duplicate``).
        """
        duplicate = self.find_active_duplicate(
            input_hash=input_hash, report_id=report_id, study_id=study_id
        )
        if duplicate is not None:
            add_audit_event(
                self.db,
                event_type="inference_deduplicated",
                actor_id=requested_by,
                report_id=report_id,
                study_id=study_id,
                metadata={
                    "job_id": duplicate.id,
                    "original_event_type": audit_event_type,
                    "input_hash": input_hash,
                    **audit_metadata,
                },
                timestamp=queued_at,
                source="api",
            )
            self.db.commit()
            return duplicate

        queue = get_queue()
        job = queue.enqueue(
            task_fn,
            job_payload,
            job_id=job_id,
            job_timeout=self.job_timeout(),
            result_ttl=self.result_ttl(),
            failure_ttl=self.result_ttl(),
            retry=default_retry(),
        )

        self.db.add(
            InferenceJob(
                id=job_id,
                report_id=report_id,
                study_id=study_id,
                status="queued",
                model_version=model_version,
                input_hash=input_hash,
                queued_at=queued_at,
                metadata_json=job_metadata,
            )
        )

        add_audit_event(
            self.db,
            event_type=audit_event_type,
            actor_id=requested_by,
            report_id=report_id,
            study_id=study_id,
            metadata=audit_metadata,
            timestamp=queued_at,
            source="api",
        )

        if report:
            if report.status == "pending":
                report.status = "in_progress"
            report.updated_at = queued_at

        self.db.commit()
        return job

    @staticmethod
    def build_response(
        job: Job,
        *,
        queued_at: datetime,
        report_id: str | None,
        study_id: str | None,
        model_version: str,
    ) -> InferenceQueueResponse:
        return InferenceQueueResponse(
            job_id=job.id,
            status=job.get_status(),
            queued_at=queued_at,
            report_id=report_id,
            study_id=study_id,
            model_version=model_version,
        )
