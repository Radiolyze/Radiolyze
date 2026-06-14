"""Inference job enqueuing.

Encapsulates the shared "tail" of the inference queue endpoints: enqueue the
RQ task, persist the queued InferenceJob row, write the audit event and bump
the owning report's status. The route handlers keep request validation, hash
computation, payload assembly and the (async) WebSocket broadcast.
"""

from __future__ import annotations

import os
from collections.abc import Callable
from typing import Any

from rq.job import Job
from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..models import InferenceJob, Report
from ..queue import get_queue
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
        queued_at: str,
        job_metadata: dict[str, Any],
        audit_event_type: str,
        audit_metadata: dict[str, Any],
    ) -> Job:
        """Enqueue a task, persist the queued job row + audit event, and bump
        the report status. Returns the enqueued RQ job."""
        queue = get_queue()
        job = queue.enqueue(
            task_fn,
            job_payload,
            job_id=job_id,
            job_timeout=self.job_timeout(),
            result_ttl=self.result_ttl(),
            failure_ttl=self.result_ttl(),
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
        queued_at: str,
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
