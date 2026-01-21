from __future__ import annotations

import uuid
from typing import Any

from .db import SessionLocal
from .mock_logic import generate_inference_summary, utc_now
from .models import AuditEvent, Report


def _create_audit_event(
    db,
    *,
    event_type: str,
    actor_id: str | None,
    report_id: str | None,
    study_id: str | None,
    metadata: dict[str, Any] | None,
) -> None:
    event = AuditEvent(
        id=str(uuid.uuid4()),
        event_type=event_type,
        actor_id=actor_id,
        report_id=report_id,
        study_id=study_id,
        timestamp=utc_now(),
        metadata_json=metadata,
    )
    db.add(event)
    db.commit()


def run_inference_job(payload: dict[str, Any]) -> dict[str, Any]:
    report_id = payload.get("report_id")
    study_id = payload.get("study_id")
    findings_text = payload.get("findings_text")
    requested_by = payload.get("requested_by") or "system"
    model_version = payload.get("model_version") or "mock-medgemma-0.1"
    input_hash = payload.get("input_hash")
    job_id = payload.get("job_id")

    db = SessionLocal()
    try:
        _create_audit_event(
            db,
            event_type="inference_started",
            actor_id=requested_by,
            report_id=report_id,
            study_id=study_id,
            metadata={
                "job_id": job_id,
                "model_version": model_version,
                "input_hash": input_hash,
            },
        )

        summary, confidence = generate_inference_summary(findings_text)
        completed_at = utc_now()
        output_summary = summary[:240]

        _create_audit_event(
            db,
            event_type="inference_completed",
            actor_id=requested_by,
            report_id=report_id,
            study_id=study_id,
            metadata={
                "job_id": job_id,
                "model_version": model_version,
                "input_hash": input_hash,
                "output_summary": output_summary,
                "confidence": confidence,
            },
        )

        if report_id:
            report = db.get(Report, report_id)
            if report:
                report.updated_at = completed_at
                db.commit()

        return {
            "summary": summary,
            "confidence": confidence,
            "model_version": model_version,
            "completed_at": completed_at,
        }
    except Exception as exc:
        _create_audit_event(
            db,
            event_type="inference_failed",
            actor_id=requested_by,
            report_id=report_id,
            study_id=study_id,
            metadata={
                "job_id": job_id,
                "model_version": model_version,
                "input_hash": input_hash,
                "error": str(exc),
            },
        )
        raise
    finally:
        db.close()
