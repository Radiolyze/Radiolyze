"""Reading back the state of an inference job.

Two pieces of logic that were sitting in the route: the lazy timeout sweep for
jobs whose worker never reported back, and the allow-list that decides which of
the worker's metadata keys a client may see.
"""

from __future__ import annotations

from fastapi import HTTPException
from rq.exceptions import NoSuchJobError
from rq.job import Job
from sqlalchemy.orm import Session

from ...models import InferenceJob
from ...queue import get_redis
from ...schemas import InferenceStatusResponse
from ...utils.time import format_datetime, utc_now
from ..inference_service import InferenceService

# The metadata keys a client may see. The stored blob is worker-controlled and
# also holds request internals, so this is an allow-list rather than a
# deny-list: a new key added by the worker stays invisible until it is listed
# here deliberately.
_CLIENT_VISIBLE_METADATA_KEYS = frozenset(
    {
        "schema_name",
        "schema_version",
        "json_parsed",
        "json_schema_valid",
        "json_error",
        "evidence_missing",
        "images_used",
        "confidence_label",
        "provider",
        "latency_ms",
    }
)


def filter_inference_metadata(metadata: dict | None) -> dict[str, object] | None:
    if not isinstance(metadata, dict):
        return None
    filtered = {key: metadata[key] for key in _CLIENT_VISIBLE_METADATA_KEYS if key in metadata}
    prompt = metadata.get("prompt")
    if isinstance(prompt, dict):
        filtered["prompt"] = prompt
    return filtered or None


def _expire_if_stuck(db: Session, job_record: InferenceJob) -> None:
    """Fail a job that started but never reported a result.

    A worker killed mid-job leaves its row on "started" forever; nothing else
    ever moves it, so the read path does it.
    """
    if job_record.status not in ("queued", "started") or not job_record.queued_at:
        return

    timeout_seconds = InferenceService.job_timeout()
    # queued_at is loaded through UTCDateTime, so it is always aware
    # and always UTC — no re-tagging needed before subtracting.
    elapsed = (utc_now() - job_record.queued_at).total_seconds()
    if elapsed > timeout_seconds:
        job_record.status = "failed"
        job_record.error_message = f"Job timed out after {timeout_seconds}s"
        job_record.completed_at = utc_now()
        db.commit()


def _build_result(job_record: InferenceJob) -> dict[str, object] | None:
    if job_record.status != "finished":
        return None

    image_refs = None
    evidence_indices = None
    findings = None
    metadata = None
    if isinstance(job_record.metadata_json, dict):
        image_refs = job_record.metadata_json.get("image_refs")
        evidence_indices = job_record.metadata_json.get("evidence_indices")
        findings = job_record.metadata_json.get("findings")
        metadata = filter_inference_metadata(job_record.metadata_json)

    return {
        "summary": job_record.summary_text,
        "confidence": job_record.confidence,
        "model_version": job_record.model_version,
        "completed_at": format_datetime(job_record.completed_at),
        "image_refs": image_refs,
        "evidence_indices": evidence_indices,
        "findings": findings,
        "metadata": metadata,
    }


def read_job_status(db: Session, job_id: str) -> InferenceStatusResponse:
    """Report a job's state, preferring the DB row over RQ's own bookkeeping.

    The row outlives the RQ job (whose keys expire on a TTL), so a job that has
    been recorded is answered from Postgres; only one never persisted -- or one
    still in flight before its row was written -- falls through to Redis.
    """
    job_record = db.get(InferenceJob, job_id)
    if job_record:
        _expire_if_stuck(db, job_record)
        return InferenceStatusResponse(
            job_id=job_record.id,
            status=job_record.status,
            queued_at=job_record.queued_at,
            started_at=job_record.started_at,
            ended_at=job_record.completed_at,
            result=_build_result(job_record),
            error=job_record.error_message,
        )

    try:
        job = Job.fetch(job_id, connection=get_redis())
    except NoSuchJobError as exc:
        raise HTTPException(status_code=404, detail="Inference job not found") from exc

    error = None
    if job.is_failed:
        if job.exc_info:
            error = job.exc_info.splitlines()[-1]
        else:
            error = "Inference job failed"

    return InferenceStatusResponse(
        job_id=job.id,
        status=job.get_status(),
        queued_at=job.enqueued_at,
        started_at=job.started_at,
        ended_at=job.ended_at,
        result=job.result if job.is_finished else None,
        error=error,
    )
