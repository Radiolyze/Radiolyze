from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from rq.exceptions import NoSuchJobError
from rq.job import Job
from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..deps import get_db
from ..mock_logic import utc_now
from ..models import InferenceJob, Report
from ..queue import get_queue, get_redis
from ..schemas import (
    InferenceQueueRequest,
    InferenceQueueResponse,
    InferenceStatusResponse,
    LocalizeRequest,
)
from ..tasks import run_inference_job, run_localize_job
from ..utils.hashing import compute_input_hash, compute_localize_hash
from ..utils.inference import build_image_metadata
from ..utils.time import format_datetime
from ..ws_manager import broadcast_status

router = APIRouter()


def _filter_inference_metadata(metadata: dict | None) -> dict[str, object] | None:
    if not isinstance(metadata, dict):
        return None
    allowed_keys = {
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
    filtered = {key: metadata[key] for key in allowed_keys if key in metadata}
    prompt = metadata.get("prompt")
    if isinstance(prompt, dict):
        filtered["prompt"] = prompt
    return filtered or None


def _get_inference_job_timeout() -> int:
    return int(os.getenv("INFERENCE_JOB_TIMEOUT", "600"))


def _get_inference_result_ttl() -> int:
    return int(os.getenv("INFERENCE_RESULT_TTL", "3600"))


def _get_model_version() -> str:
    return os.getenv("INFERENCE_MODEL_VERSION") or os.getenv("VLLM_MODEL_NAME", "mock-medgemma-0.1")


@router.post("/api/v1/inference/queue", response_model=InferenceQueueResponse)
async def queue_inference(
    payload: InferenceQueueRequest,
    db: Session = Depends(get_db),
) -> InferenceQueueResponse:
    report = None
    if payload.report_id:
        report = db.get(Report, payload.report_id)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

    requested_by = payload.requested_by or "system"
    study_id = payload.study_id or (report.study_id if report else None)
    findings_text = payload.findings_text or (report.findings_text if report else None)
    image_urls = payload.image_urls or []
    image_paths = payload.image_paths or []
    image_refs = [ref.model_dump() for ref in (payload.image_refs or [])]
    model_version = payload.model_version or _get_model_version()
    input_hash = compute_input_hash(study_id, findings_text, image_urls, image_paths, image_refs)
    queued_at = utc_now()
    image_metadata = build_image_metadata(image_urls, image_paths, image_refs)

    job_id = str(uuid.uuid4())
    job_payload = {
        "job_id": job_id,
        "report_id": payload.report_id,
        "study_id": study_id,
        "findings_text": findings_text,
        "image_urls": image_urls,
        "image_paths": image_paths,
        "image_refs": image_refs,
        "requested_by": requested_by,
        "model_version": model_version,
        "input_hash": input_hash,
    }

    queue = get_queue()
    job = queue.enqueue(
        run_inference_job,
        job_payload,
        job_id=job_id,
        job_timeout=_get_inference_job_timeout(),
        result_ttl=_get_inference_result_ttl(),
        failure_ttl=_get_inference_result_ttl(),
    )

    db.add(
        InferenceJob(
            id=job_id,
            report_id=payload.report_id,
            study_id=study_id,
            status="queued",
            model_version=model_version,
            input_hash=input_hash,
            queued_at=queued_at,
            metadata_json={"requested_by": requested_by, "image_refs": image_refs, **image_metadata},
        )
    )

    add_audit_event(
        db,
        event_type="inference_queued",
        actor_id=requested_by,
        report_id=payload.report_id,
        study_id=study_id,
        metadata={
            "job_id": job_id,
            "model_version": model_version,
            "input_hash": input_hash,
            "image_refs": image_refs,
            **image_metadata,
        },
        timestamp=queued_at,
        source="api",
    )

    if report:
        if report.status == "pending":
            report.status = "in_progress"
        report.updated_at = queued_at

    db.commit()

    if payload.report_id:
        await broadcast_status(
            payload.report_id,
            {"aiStatus": "queued", "qaStatus": report.qa_status if report else "pending", "asrStatus": "idle"},
        )

    return InferenceQueueResponse(
        job_id=job.id,
        status=job.get_status(),
        queued_at=queued_at,
        report_id=payload.report_id,
        study_id=study_id,
        model_version=model_version,
    )


@router.post("/api/v1/inference/localize", response_model=InferenceQueueResponse)
async def queue_localize(
    payload: LocalizeRequest,
    db: Session = Depends(get_db),
) -> InferenceQueueResponse:
    """Queue on-demand single-frame localization (bounding-box findings)."""
    report = None
    if payload.report_id:
        report = db.get(Report, payload.report_id)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

    requested_by = payload.requested_by or "system"
    study_id = payload.study_id or (report.study_id if report else None)
    image_ref = payload.image_ref.model_dump()
    model_version = payload.model_version or _get_model_version()
    input_hash = compute_localize_hash(study_id, image_ref)
    queued_at = utc_now()

    job_id = str(uuid.uuid4())
    job_payload = {
        "job_id": job_id,
        "report_id": payload.report_id,
        "study_id": study_id,
        "image_ref": image_ref,
        "requested_by": requested_by,
        "model_version": model_version,
        "input_hash": input_hash,
    }

    queue = get_queue()
    job = queue.enqueue(
        run_localize_job,
        job_payload,
        job_id=job_id,
        job_timeout=_get_inference_job_timeout(),
        result_ttl=_get_inference_result_ttl(),
        failure_ttl=_get_inference_result_ttl(),
    )

    db.add(
        InferenceJob(
            id=job_id,
            report_id=payload.report_id,
            study_id=study_id,
            status="queued",
            model_version=model_version,
            input_hash=input_hash,
            queued_at=queued_at,
            metadata_json={"requested_by": requested_by, "image_ref": image_ref, "job_type": "localize"},
        )
    )

    add_audit_event(
        db,
        event_type="inference_queued",
        actor_id=requested_by,
        report_id=payload.report_id,
        study_id=study_id,
        metadata={
            "job_id": job_id,
            "job_type": "localize",
            "model_version": model_version,
            "input_hash": input_hash,
            "image_ref": image_ref,
        },
        timestamp=queued_at,
        source="api",
    )

    if report:
        if report.status == "pending":
            report.status = "in_progress"
        report.updated_at = queued_at

    db.commit()

    if payload.report_id:
        await broadcast_status(
            payload.report_id,
            {"aiStatus": "queued", "qaStatus": report.qa_status if report else "pending", "asrStatus": "idle"},
        )

    return InferenceQueueResponse(
        job_id=job.id,
        status=job.get_status(),
        queued_at=queued_at,
        report_id=payload.report_id,
        study_id=study_id,
        model_version=model_version,
    )


@router.get("/api/v1/inference/status/{job_id}", response_model=InferenceStatusResponse)
def inference_status(job_id: str, db: Session = Depends(get_db)) -> InferenceStatusResponse:
    job_record = db.get(InferenceJob, job_id)
    if job_record:
        # Detect stuck jobs: started but no completion within timeout
        if job_record.status in ("queued", "started") and job_record.queued_at:
            from datetime import datetime, timezone
            timeout_seconds = _get_inference_job_timeout()
            now = datetime.now(timezone.utc)
            queued_at = job_record.queued_at if job_record.queued_at.tzinfo else job_record.queued_at.replace(tzinfo=timezone.utc)
            elapsed = (now - queued_at).total_seconds()
            if elapsed > timeout_seconds:
                job_record.status = "failed"
                job_record.error_message = f"Job timed out after {timeout_seconds}s"
                job_record.completed_at = utc_now()
                db.commit()

        result = None
        if job_record.status == "finished":
            image_refs = None
            evidence_indices = None
            findings = None
            metadata = None
            if isinstance(job_record.metadata_json, dict):
                image_refs = job_record.metadata_json.get("image_refs")
                evidence_indices = job_record.metadata_json.get("evidence_indices")
                findings = job_record.metadata_json.get("findings")
                metadata = _filter_inference_metadata(job_record.metadata_json)
            result = {
                "summary": job_record.summary_text,
                "confidence": job_record.confidence,
                "model_version": job_record.model_version,
                "completed_at": job_record.completed_at,
                "image_refs": image_refs,
                "evidence_indices": evidence_indices,
                "findings": findings,
                "metadata": metadata,
            }
        return InferenceStatusResponse(
            job_id=job_record.id,
            status=job_record.status,
            queued_at=format_datetime(job_record.queued_at),
            started_at=format_datetime(job_record.started_at),
            ended_at=format_datetime(job_record.completed_at),
            result=result,
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

    result = job.result if job.is_finished else None

    return InferenceStatusResponse(
        job_id=job.id,
        status=job.get_status(),
        queued_at=format_datetime(job.enqueued_at),
        started_at=format_datetime(job.started_at),
        ended_at=format_datetime(job.ended_at),
        result=result,
        error=error,
    )
