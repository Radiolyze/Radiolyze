"""The state every inference queue request resolves before it is enqueued.

The four queue routes (`/queue`, `/localize`, `/volume`, `/comparison`) differ
only in how they hash their input and what they put in the job payload. Every
other step -- resolving the report, defaulting the requester and study, picking
a model version, minting the job id -- is identical, and lives here.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ...models import Report
from ...utils.time import utc_now
from ..inference_service import InferenceService


class QueuePayload(Protocol):
    """The fields every queue request schema has in common.

    Structural rather than a shared base class: the four request models are
    part of the public API schema and are deliberately flat.
    """

    report_id: str | None
    study_id: str | None
    requested_by: str | None
    model_version: str | None


@dataclass(frozen=True)
class QueueContext:
    """Request-scoped values shared by every queue route."""

    db: Session
    report: Report | None
    report_id: str | None
    study_id: str | None
    requested_by: str
    model_version: str
    job_id: str
    queued_at: datetime

    def findings_text(self, requested: str | None) -> str | None:
        """Explicit findings win; otherwise they come off the owning report.

        Not resolved eagerly in ``resolve`` because ``LocalizeRequest`` has no
        ``findings_text`` field at all -- localization works from the frame.
        """
        return requested or (self.report.findings_text if self.report else None)

    @property
    def qa_status(self) -> str:
        """The QA status broadcast alongside the queued status."""
        return self.report.qa_status if self.report else "pending"

    @classmethod
    def resolve(cls, db: Session, payload: QueuePayload) -> QueueContext:
        report = None
        if payload.report_id:
            report = db.get(Report, payload.report_id)
            if not report:
                raise HTTPException(status_code=404, detail="Report not found")

        return cls(
            db=db,
            report=report,
            report_id=payload.report_id,
            study_id=payload.study_id or (report.study_id if report else None),
            requested_by=payload.requested_by or "system",
            model_version=payload.model_version or InferenceService.model_version(),
            job_id=str(uuid.uuid4()),
            queued_at=utc_now(),
        )


@dataclass(frozen=True)
class JobSpec:
    """What one job type contributes on top of the shared skeleton.

    ``payload``, ``job_metadata`` and ``audit_metadata`` hold only the
    type-specific keys; the runner merges in the common ones (``job_id``,
    ``report_id``, ``study_id``, ``requested_by``, ``model_version``,
    ``input_hash``) so no route has to repeat them.
    """

    task_fn: Callable[..., Any]
    input_hash: str
    audit_event_type: str
    payload: dict[str, Any]
    job_metadata: dict[str, Any]
    audit_metadata: dict[str, Any]
