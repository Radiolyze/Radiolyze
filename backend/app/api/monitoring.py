from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..deps import get_db
from ..models import AuditEvent, DriftSnapshot, InferenceJob, QACheckResult, Report
from ..utils.metrics import (
    compute_deltas,
    counts_to_dict,
    get_threshold,
    summarize_inference_jobs,
    summarize_qa_results,
)
from ..utils.time import now_iso

router = APIRouter()


def compute_drift_snapshot(
    db: Session,
    window_days: int = 7,
    baseline_days: int | None = None,
    persist: bool = True,
) -> dict[str, Any]:
    """Compute a drift report and optionally persist a snapshot.

    Extracted from the HTTP handler so it can be called by the scheduler
    without an HTTP request context.
    """
    now = datetime.now(UTC)
    baseline_days = baseline_days or window_days
    window_start = now - timedelta(days=window_days)
    baseline_start = window_start - timedelta(days=baseline_days)

    window_start_iso = window_start.isoformat()
    window_end_iso = now.isoformat()
    baseline_start_iso = baseline_start.isoformat()
    baseline_end_iso = window_start_iso

    current_jobs = (
        db.query(InferenceJob)
        .filter(
            InferenceJob.completed_at >= window_start_iso,
            InferenceJob.completed_at < window_end_iso,
        )
        .all()
    )
    baseline_jobs = (
        db.query(InferenceJob)
        .filter(
            InferenceJob.completed_at >= baseline_start_iso,
            InferenceJob.completed_at < baseline_end_iso,
        )
        .all()
    )
    current_qa = (
        db.query(QACheckResult)
        .filter(
            QACheckResult.created_at >= window_start_iso,
            QACheckResult.created_at < window_end_iso,
        )
        .all()
    )
    baseline_qa = (
        db.query(QACheckResult)
        .filter(
            QACheckResult.created_at >= baseline_start_iso,
            QACheckResult.created_at < baseline_end_iso,
        )
        .all()
    )

    current_inference = summarize_inference_jobs(current_jobs)
    baseline_inference = summarize_inference_jobs(baseline_jobs)
    current_qa_summary = summarize_qa_results(current_qa)
    baseline_qa_summary = summarize_qa_results(baseline_qa)

    inference_deltas = compute_deltas(
        current_inference,
        baseline_inference,
        ["confidence_avg", "confidence_median", "failure_rate"],
    )
    qa_deltas = compute_deltas(
        current_qa_summary,
        baseline_qa_summary,
        ["pass_rate", "quality_score_avg"],
    )

    alerts: list[dict[str, Any]] = []
    confidence_delta = inference_deltas.get("confidence_avg")
    failure_delta = inference_deltas.get("failure_rate")
    pass_rate_delta = qa_deltas.get("pass_rate")
    score_delta = qa_deltas.get("quality_score_avg")

    if confidence_delta is not None and abs(confidence_delta) >= get_threshold(
        "DRIFT_CONFIDENCE_DELTA", 0.1
    ):
        alerts.append(
            {
                "metric": "inference.confidence_avg",
                "delta": confidence_delta,
                "threshold": get_threshold("DRIFT_CONFIDENCE_DELTA", 0.1),
            }
        )
    if failure_delta is not None and abs(failure_delta) >= get_threshold(
        "DRIFT_INFERENCE_FAILURE_DELTA", 0.05
    ):
        alerts.append(
            {
                "metric": "inference.failure_rate",
                "delta": failure_delta,
                "threshold": get_threshold("DRIFT_INFERENCE_FAILURE_DELTA", 0.05),
            }
        )
    if pass_rate_delta is not None and abs(pass_rate_delta) >= get_threshold(
        "DRIFT_QA_PASS_RATE_DELTA", 0.1
    ):
        alerts.append(
            {
                "metric": "qa.pass_rate",
                "delta": pass_rate_delta,
                "threshold": get_threshold("DRIFT_QA_PASS_RATE_DELTA", 0.1),
            }
        )
    if score_delta is not None and abs(score_delta) >= get_threshold("DRIFT_QA_SCORE_DELTA", 5.0):
        alerts.append(
            {
                "metric": "qa.quality_score_avg",
                "delta": score_delta,
                "threshold": get_threshold("DRIFT_QA_SCORE_DELTA", 5.0),
            }
        )

    response_payload = {
        "window_days": window_days,
        "baseline_days": baseline_days,
        "window": {"start": window_start_iso, "end": window_end_iso},
        "baseline_window": {"start": baseline_start_iso, "end": baseline_end_iso},
        "current": {"inference": current_inference, "qa": current_qa_summary},
        "baseline": {"inference": baseline_inference, "qa": baseline_qa_summary},
        "delta": {"inference": inference_deltas, "qa": qa_deltas},
        "alerts": alerts,
    }

    if persist:
        snapshot_id = str(uuid.uuid4())
        snapshot = DriftSnapshot(
            id=snapshot_id,
            created_at=now_iso(),
            window_days=window_days,
            baseline_days=baseline_days,
            payload=response_payload,
        )
        db.add(snapshot)
        add_audit_event(
            db,
            event_type="drift_snapshot_created",
            actor_id="system",
            metadata={
                "snapshot_id": snapshot_id,
                "alerts_count": len(alerts),
                "window_days": window_days,
                "baseline_days": baseline_days,
            },
            source="scheduler",
        )
        if alerts:
            add_audit_event(
                db,
                event_type="drift_alert_triggered",
                actor_id="system",
                metadata={"snapshot_id": snapshot_id, "alerts": alerts},
                source="scheduler",
            )
        db.commit()

    return response_payload


@router.get("/api/v1/metrics")
def get_metrics(db: Session = Depends(get_db)) -> dict[str, Any]:
    reports_total = db.query(func.count(Report.id)).scalar() or 0
    reports_by_status = counts_to_dict(
        db.query(Report.status, func.count(Report.id)).group_by(Report.status).all()
    )
    qa_status_counts = counts_to_dict(
        db.query(Report.qa_status, func.count(Report.id)).group_by(Report.qa_status).all()
    )
    inference_job_counts = counts_to_dict(
        db.query(InferenceJob.status, func.count(InferenceJob.id))
        .group_by(InferenceJob.status)
        .all()
    )
    audit_events_total = db.query(func.count(AuditEvent.id)).scalar() or 0

    return {
        "timestamp": now_iso(),
        "reports_total": reports_total,
        "reports_by_status": reports_by_status,
        "qa_status_counts": qa_status_counts,
        "inference_job_status_counts": inference_job_counts,
        "audit_events_total": audit_events_total,
    }


@router.get("/api/v1/monitoring/drift")
def get_drift_report(
    window_days: int = Query(7, ge=1, le=90),
    baseline_days: int | None = Query(None, ge=1, le=365),
    persist: bool = Query(False),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return compute_drift_snapshot(db, window_days=window_days,
                                  baseline_days=baseline_days, persist=persist)


@router.get("/api/v1/monitoring/drift/snapshots")
def list_drift_snapshots(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    snapshots = (
        db.query(DriftSnapshot)
        .order_by(DriftSnapshot.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": snapshot.id,
            "created_at": snapshot.created_at,
            "window_days": snapshot.window_days,
            "baseline_days": snapshot.baseline_days,
            "payload": snapshot.payload,
        }
        for snapshot in snapshots
    ]
