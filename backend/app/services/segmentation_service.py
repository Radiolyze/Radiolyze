"""Segmentation job creation and segmenter status reconciliation.

Encapsulates the business logic behind the segmentation endpoints: creating a
queued job (DB row + audit + RQ enqueue) and refreshing a job row from the
segmenter microservice when the worker hasn't caught up yet. Streaming,
path-safety and PACS push concerns remain in the route handlers.
"""

from __future__ import annotations

import os
import uuid

from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..mock_logic import utc_now
from ..models import SegmentationJob
from ..queue import get_queue
from ..schemas_segmentation import SegmentationCreateRequest
from ..segmentation_client import get_job_status as segmenter_status
from ..segmentation_client import segmentation_data_dir
from ..tasks import run_segmentation_job


class SegmentationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def job_timeout() -> int:
        try:
            return int(os.getenv("SEGMENTATION_JOB_TIMEOUT", "1800"))
        except ValueError:
            return 1800

    @staticmethod
    def result_ttl() -> int:
        try:
            return int(os.getenv("SEGMENTATION_RESULT_TTL", "3600"))
        except ValueError:
            return 3600

    def create_job(self, payload: SegmentationCreateRequest) -> tuple[str, str]:
        """Persist a queued job row + audit event and enqueue the worker task.

        Returns ``(job_id, queued_at)``.
        """
        job_id = str(uuid.uuid4())
        queued_at = utc_now()
        requested_by = payload.requested_by or "system"
        data_dir = str(segmentation_data_dir() / job_id)

        self.db.add(
            SegmentationJob(
                id=job_id,
                study_uid=payload.study_uid,
                series_uid=payload.series_uid,
                preset=payload.preset,
                status="queued",
                progress=0.0,
                created_by=requested_by,
                created_at=queued_at,
                updated_at=queued_at,
                data_dir=data_dir,
            )
        )

        add_audit_event(
            self.db,
            event_type="segmentation_queued",
            actor_id=requested_by,
            study_id=payload.study_uid,
            metadata={
                "job_id": job_id,
                "series_uid": payload.series_uid,
                "preset": payload.preset,
            },
            timestamp=queued_at,
            source="api",
        )
        self.db.commit()

        job_payload = {
            "job_id": job_id,
            "study_uid": payload.study_uid,
            "series_uid": payload.series_uid,
            "preset": payload.preset,
            "requested_by": requested_by,
        }
        queue = get_queue()
        queue.enqueue(
            run_segmentation_job,
            job_payload,
            job_id=job_id,
            job_timeout=self.job_timeout(),
            result_ttl=self.result_ttl(),
            failure_ttl=self.result_ttl(),
        )

        return job_id, queued_at

    def refresh_from_segmenter(self, record: SegmentationJob) -> SegmentationJob:
        """Refresh the DB row from the segmenter when the worker hasn't caught up."""
        if record.status in {"finished", "failed"}:
            return record
        try:
            payload = segmenter_status(record.id)
        except Exception:
            return record

        status = str(payload.get("status") or record.status)
        progress = payload.get("progress")
        manifest = payload.get("manifest")

        changed = False
        if isinstance(progress, (int, float)) and float(progress) != record.progress:
            record.progress = float(progress)
            changed = True
        if status == "done" and record.status != "finished":
            record.status = "finished"
            record.progress = 1.0
            if manifest:
                record.manifest_json = manifest
            record.updated_at = utc_now()
            changed = True
        elif status == "failed" and record.status != "failed":
            record.status = "failed"
            record.error_message = payload.get("error") or "Segmenter reported failure"
            record.updated_at = utc_now()
            changed = True
        elif record.status == "queued" and status not in {"queued"}:
            record.status = "started" if status == "running" else status
            record.updated_at = utc_now()
            changed = True

        if changed:
            self.db.commit()
        return record
