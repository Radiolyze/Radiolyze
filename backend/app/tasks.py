from __future__ import annotations

import logging
import uuid
from typing import Any

from .audit import add_audit_event
from .db import SessionLocal
from .inference_clients import generate_inference_summary_text, generate_localize_findings
from .mock_logic import utc_now
from .models import InferenceJob, Report
from .utils.inference import build_image_metadata
from .ws_events import publish_report_status

logger = logging.getLogger(__name__)


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
    image_metadata = build_image_metadata(image_urls, image_paths, image_refs)

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
            image_refs=image_refs,
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
        try:
            failed_job = db.get(InferenceJob, job_id) if job_id else None
            if failed_job:
                failed_job.status = "failed"
                failed_job.completed_at = utc_now()
                failed_job.error_message = str(exc)[:1000]
                db.commit()
        except Exception:
            logger.exception("Failed to update job %s status to failed", job_id)

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


def run_localize_job(payload: dict[str, Any]) -> dict[str, Any]:
    """Run single-frame localization; returns findings for overlay."""
    report_id = payload.get("report_id")
    study_id = payload.get("study_id")
    image_ref = payload.get("image_ref") or {}
    requested_by = payload.get("requested_by") or "system"
    requested_model_version = payload.get("model_version") or "mock-medgemma-0.1"
    input_hash = payload.get("input_hash")
    job_id = payload.get("job_id")

    db = SessionLocal()
    job = None
    try:
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
                metadata_json={"image_ref": image_ref, "job_type": "localize"},
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
                "job_type": "localize",
                "model_version": requested_model_version,
                "image_ref": image_ref,
            },
            source="worker",
        )
        db.commit()

        findings, resolved_model, metadata = generate_localize_findings(
            image_ref,
            model_name=requested_model_version,
        )
        completed_at = utc_now()
        summary = f"Localized {len(findings)} finding(s)" if findings else "No findings"

        job.status = "finished"
        job.completed_at = completed_at
        job.summary_text = summary
        confidences = [
            f.get("confidence", 0.0)
            for f in findings
            if isinstance(f.get("confidence"), (int, float))
        ]
        job.confidence = sum(confidences) / len(confidences) if confidences else 0.0
        job.model_version = resolved_model
        job.metadata_json = {
            **(job.metadata_json or {}),
            "requested_model": requested_model_version,
            "resolved_model": resolved_model,
            "image_ref": image_ref,
            "findings": findings,
            **(metadata or {}),
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
                "job_type": "localize",
                "model_version": requested_model_version,
                "findings_count": len(findings),
                "image_ref": image_ref,
            },
            source="worker",
        )
        db.commit()

        publish_report_status(report_id, {"aiStatus": "idle"})

        return {
            "summary": summary,
            "findings": findings,
            "model_version": resolved_model,
            "completed_at": completed_at,
        }
    except Exception as exc:
        if job_id:
            loc_job = db.get(InferenceJob, job_id)
            if loc_job:
                loc_job.status = "failed"
                loc_job.completed_at = utc_now()
                loc_job.error_message = str(exc)
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
                "job_type": "localize",
                "model_version": requested_model_version,
                "error": str(exc),
                "image_ref": image_ref,
            },
            source="worker",
        )
        db.commit()
        raise
    finally:
        db.close()


def run_segmentation_job(payload: dict[str, Any]) -> dict[str, Any]:
    """Drive a segmentation job: call the segmenter, poll, persist the manifest."""
    import os
    import time

    from .segmentation_client import (
        get_job_status as seg_get_status,
        submit_segmentation,
    )
    from .models import SegmentationJob

    job_id = payload["job_id"]
    study_uid = payload["study_uid"]
    series_uid = payload["series_uid"]
    preset = payload.get("preset", "bone")
    requested_by = payload.get("requested_by") or "system"

    poll_interval = float(os.getenv("SEGMENTATION_POLL_INTERVAL", "3"))
    timeout_s = float(os.getenv("SEGMENTATION_JOB_TIMEOUT", "900"))

    db = SessionLocal()
    try:
        job = db.get(SegmentationJob, job_id)
        if not job:
            logger.warning("Segmentation row for %s missing; aborting", job_id)
            return {"status": "missing"}

        job.status = "started"
        job.updated_at = utc_now()
        db.commit()

        add_audit_event(
            db,
            event_type="segmentation_started",
            actor_id=requested_by,
            study_id=study_uid,
            metadata={"job_id": job_id, "preset": preset, "series_uid": series_uid},
            source="worker",
        )
        db.commit()

        submit_segmentation(
            job_id=job_id,
            study_uid=study_uid,
            series_uid=series_uid,
            preset=preset,
        )

        deadline = time.monotonic() + timeout_s
        manifest: dict[str, Any] | None = None
        last_progress: float | None = None
        while time.monotonic() < deadline:
            time.sleep(poll_interval)
            status_payload = seg_get_status(job_id)
            status = str(status_payload.get("status") or "running")
            progress = float(status_payload.get("progress") or 0.0)
            if last_progress != progress:
                job.progress = progress
                job.updated_at = utc_now()
                db.commit()
                last_progress = progress

            if status == "done":
                manifest = status_payload.get("manifest") or {}
                break
            if status == "failed":
                error = status_payload.get("error") or "Segmenter reported failure"
                raise RuntimeError(error)
        else:
            raise TimeoutError(f"Segmentation job {job_id} exceeded {timeout_s}s")

        completed_at = utc_now()
        job.status = "finished"
        job.progress = 1.0
        job.manifest_json = manifest
        job.updated_at = completed_at
        db.commit()

        add_audit_event(
            db,
            event_type="segmentation_completed",
            actor_id=requested_by,
            study_id=study_uid,
            metadata={
                "job_id": job_id,
                "preset": preset,
                "series_uid": series_uid,
                "label_count": len(manifest.get("labels", [])) if manifest else 0,
            },
            source="worker",
        )
        db.commit()

        return {"status": "finished", "manifest": manifest}
    except Exception as exc:
        try:
            failed = db.get(SegmentationJob, job_id)
            if failed:
                failed.status = "failed"
                failed.error_message = str(exc)[:1000]
                failed.updated_at = utc_now()
                db.commit()
        except Exception:
            logger.exception("Failed to mark segmentation job %s as failed", job_id)

        add_audit_event(
            db,
            event_type="segmentation_failed",
            actor_id=requested_by,
            study_id=study_uid,
            metadata={
                "job_id": job_id,
                "preset": preset,
                "series_uid": series_uid,
                "error": str(exc),
            },
            source="worker",
        )
        db.commit()
        raise
    finally:
        db.close()


def embed_guideline(guideline_id: str) -> None:
    """Compute and persist a vector embedding for *guideline_id*.

    Called as an RQ background job whenever a guideline is created or updated.
    Sets embedding_status to 'done', 'skip' (no service configured), or 'failed'.
    """
    from .models import Guideline
    from .utils.embedding import embed_text

    db = SessionLocal()
    try:
        guideline = db.get(Guideline, guideline_id)
        if not guideline:
            logger.warning("embed_guideline: guideline %s not found", guideline_id)
            return

        text = "\n".join(
            part for part in [guideline.title, guideline.body, guideline.keywords] if part
        )
        vec = embed_text(text)
        guideline.embedding_vec = vec
        guideline.embedding_status = "done" if vec is not None else "skip"
        db.commit()
        logger.info(
            "embed_guideline: %s → status=%s", guideline_id, guideline.embedding_status
        )
    except Exception:
        logger.exception("embed_guideline failed for %s", guideline_id)
        try:
            g = db.get(Guideline, guideline_id)
            if g:
                g.embedding_status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
