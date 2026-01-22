from __future__ import annotations

import uuid
from typing import Any

from .audit import add_audit_event
from .db import SessionLocal
from .inference_clients import generate_inference_summary_text
from .mock_logic import utc_now
from .models import InferenceJob, Report
from .ws_events import publish_report_status


def _build_image_metadata(
    image_urls: list[str] | None,
    image_paths: list[str] | None,
    image_refs: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    normalized_urls = [url.strip() for url in (image_urls or []) if url and url.strip()]
    normalized_paths = [path.strip() for path in (image_paths or []) if path and path.strip()]
    count = len(normalized_urls) + len(normalized_paths)
    refs_count = len(image_refs or [])
    if count == 0:
        return {"image_refs_count": refs_count} if refs_count else {}
    sources = []
    if normalized_urls:
        sources.append("url")
    if normalized_paths:
        sources.append("path")
    metadata: dict[str, Any] = {"image_count": count, "image_sources": sources}
    if refs_count:
        metadata["image_refs_count"] = refs_count
    return metadata


def run_inference_job(payload: dict[str, Any]) -> dict[str, Any]:
    report_id = payload.get("report_id")
    study_id = payload.get("study_id")
    findings_text = payload.get("findings_text")
    image_urls = payload.get("image_urls") or []
    image_paths = payload.get("image_paths") or []
    image_refs = payload.get("image_refs") or []
    requested_by = payload.get("requested_by") or "system"
    requested_model_version = payload.get("model_version") or "mock-medgemma-0.1"
    input_hash = payload.get("input_hash")
    job_id = payload.get("job_id")
    image_metadata = _build_image_metadata(image_urls, image_paths, image_refs)

    db = SessionLocal()
    try:
        job = None
        if job_id:
            job = db.get(InferenceJob, job_id)
        if not job:
            job = InferenceJob(
                id=job_id or str(uuid.uuid4()),
                report_id=report_id,
                study_id=study_id,
                status="queued",
                model_version=requested_model_version,
                input_hash=input_hash,
                queued_at=utc_now(),
                metadata_json={"image_refs": image_refs},
            )
            db.add(job)
            db.commit()

        started_at = utc_now()
        job.status = "started"
        job.started_at = started_at
        job.error_message = None
        db.commit()

        publish_report_status(report_id, {"aiStatus": "processing"})

        add_audit_event(
            db,
            event_type="inference_started",
            actor_id=requested_by,
            report_id=report_id,
            study_id=study_id,
            metadata={
                "job_id": job.id,
                "model_version": requested_model_version,
                "requested_model": requested_model_version,
                "input_hash": input_hash,
                "image_refs": image_refs,
                **image_metadata,
            },
            source="worker",
        )
        db.commit()

        summary, confidence, resolved_model, metadata = generate_inference_summary_text(
            findings_text,
            model_name=requested_model_version,
            image_urls=image_urls,
            image_paths=image_paths,
        )
        completed_at = utc_now()
        output_summary = summary[:240]

        job.status = "finished"
        job.completed_at = completed_at
        job.summary_text = summary
        job.confidence = confidence
        job.model_version = resolved_model
        job.metadata_json = {
            **(job.metadata_json or {}),
            **(metadata or {}),
            "requested_model": requested_model_version,
            "resolved_model": resolved_model,
            "image_refs": image_refs,
        }
        db.commit()

        add_audit_event(
            db,
            event_type="inference_completed",
            actor_id=requested_by,
            report_id=report_id,
            study_id=study_id,
            metadata={
                "job_id": job.id,
                "model_version": requested_model_version,
                "requested_model": requested_model_version,
                "resolved_model": resolved_model,
                "input_hash": input_hash,
                "output_summary": output_summary,
                "confidence": confidence,
                "image_refs": image_refs,
                **(metadata or {}),
                **image_metadata,
            },
            source="worker",
        )
        db.commit()

        if report_id:
            report = db.get(Report, report_id)
            if report:
                report.impression_text = summary
                report.updated_at = completed_at
                if report.status in {"pending", "in_progress"}:
                    report.status = "draft"
                db.commit()

        publish_report_status(report_id, {"aiStatus": "idle"})

        return {
            "summary": summary,
            "confidence": confidence,
            "model_version": resolved_model,
            "completed_at": completed_at,
        }
    except Exception as exc:
        if job_id:
            job = db.get(InferenceJob, job_id)
            if job:
                job.status = "failed"
                job.completed_at = utc_now()
                job.error_message = str(exc)
                db.commit()

        publish_report_status(report_id, {"aiStatus": "error"})

        add_audit_event(
            db,
            event_type="inference_failed",
            actor_id=requested_by,
            report_id=report_id,
            study_id=study_id,
            metadata={
                "job_id": job_id,
                "model_version": requested_model_version,
                "requested_model": requested_model_version,
                "input_hash": input_hash,
                "error": str(exc),
                "image_refs": image_refs,
                **image_metadata,
            },
            source="worker",
        )
        db.commit()
        raise
    finally:
        db.close()
