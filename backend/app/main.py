from __future__ import annotations

import asyncio
import contextlib
import hashlib
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from rq.exceptions import NoSuchJobError
from rq.job import Job
from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine
from .mock_logic import generate_asr_transcript, generate_impression, run_qa_checks, utc_now
from .models import AuditEvent, InferenceJob, QACheckResult, Report
from .queue import get_queue, get_redis
from .schemas import (
    ASRResponse,
    AuditEventRequest,
    AuditEventResponse,
    InferenceQueueRequest,
    InferenceQueueResponse,
    InferenceStatusResponse,
    ImpressionRequest,
    ImpressionResponse,
    QAResponse,
    QACheckRequest,
    ReportCreateRequest,
    ReportFinalizeRequest,
    ReportResponse,
)
from .tasks import run_inference_job
from .ws import ConnectionManager
from .ws_events import run_ws_bridge

app = FastAPI(title="Orchestrator API", version="0.1.0")

cors_origins = os.getenv("CORS_ORIGINS", "*")
origin_list = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
if not origin_list:
    origin_list = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def compute_input_hash(study_id: str | None, findings_text: str | None) -> str:
    raw = f"{study_id or ''}|{(findings_text or '').strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_inference_job_timeout() -> int:
    return int(os.getenv("INFERENCE_JOB_TIMEOUT", "600"))


def get_inference_result_ttl() -> int:
    return int(os.getenv("INFERENCE_RESULT_TTL", "3600"))


def format_datetime(value: datetime | str | None) -> str | None:
    if not value:
        return None
    if isinstance(value, str):
        return value
    return value.isoformat()


def serialize_report(report: Report) -> ReportResponse:
    return ReportResponse(
        id=report.id,
        study_id=report.study_id,
        patient_id=report.patient_id,
        status=report.status,
        findings_text=report.findings_text,
        impression_text=report.impression_text,
        created_at=report.created_at,
        updated_at=report.updated_at,
        approved_at=report.approved_at,
        approved_by=report.approved_by,
        qa_status=report.qa_status,
        qa_warnings=report.qa_warnings or [],
    )


def serialize_audit_event(event: AuditEvent) -> AuditEventResponse:
    return AuditEventResponse(
        id=event.id,
        event_type=event.event_type,
        actor_id=event.actor_id,
        report_id=event.report_id,
        study_id=event.study_id,
        timestamp=event.timestamp,
        metadata=event.metadata_json,
    )


async def broadcast_status(report_id: str | None, payload: dict[str, Any]) -> None:
    if not report_id:
        return
    await manager.broadcast(
        {
            "type": "report_status",
            "reportId": report_id,
            "payload": payload,
            "timestamp": now_iso(),
        }
    )


@app.on_event("startup")
async def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    app.state.ws_bridge_task = asyncio.create_task(run_ws_bridge(manager))


@app.on_event("shutdown")
async def on_shutdown() -> None:
    task = getattr(app.state, "ws_bridge_task", None)
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/reports/create", response_model=ReportResponse)
def create_report(payload: ReportCreateRequest, db: Session = Depends(get_db)) -> ReportResponse:
    report_id = payload.report_id or str(uuid.uuid4())
    now = utc_now()

    report = Report(
        id=report_id,
        study_id=payload.study_id,
        patient_id=payload.patient_id,
        status=payload.status or "pending",
        findings_text=payload.findings_text or "",
        impression_text=payload.impression_text or "",
        created_at=now,
        updated_at=now,
        qa_status="pending",
        qa_warnings=[],
    )

    db.add(report)
    db.commit()
    db.refresh(report)
    return serialize_report(report)


@app.get("/api/v1/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)) -> ReportResponse:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return serialize_report(report)


@app.post("/api/v1/reports/{report_id}/finalize", response_model=ReportResponse)
async def finalize_report(
    report_id: str,
    payload: ReportFinalizeRequest,
    db: Session = Depends(get_db),
) -> ReportResponse:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    now = utc_now()
    report.status = "finalized"
    report.approved_at = now
    report.approved_by = payload.approved_by or payload.signature
    report.updated_at = now

    db.commit()
    db.refresh(report)

    await broadcast_status(
        report_id,
        {"qaStatus": report.qa_status, "aiStatus": "idle", "asrStatus": "idle"},
    )
    return serialize_report(report)


@app.post("/api/v1/reports/asr-transcript", response_model=ASRResponse)
async def asr_transcript(
    file: UploadFile = File(...),
    report_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> ASRResponse:
    _ = file
    text, confidence = generate_asr_transcript()
    timestamp = utc_now()

    if report_id:
        report = db.get(Report, report_id)
        if report:
            report.updated_at = timestamp
            db.commit()
        await broadcast_status(
            report_id,
            {"asrStatus": "processing", "asrConfidence": confidence, "aiStatus": "idle", "qaStatus": report.qa_status if report else "pending"},
        )

    return ASRResponse(text=text, confidence=confidence, timestamp=timestamp)


@app.post("/api/v1/reports/generate-impression", response_model=ImpressionResponse)
async def generate_impression_endpoint(
    payload: ImpressionRequest,
    db: Session = Depends(get_db),
) -> ImpressionResponse:
    text, confidence = generate_impression(payload.findings_text)
    generated_at = utc_now()

    if payload.report_id:
        report = db.get(Report, payload.report_id)
        if report:
            report.impression_text = text
            report.updated_at = generated_at
            if report.status in {"pending", "in_progress"}:
                report.status = "draft"
            db.commit()

        await broadcast_status(
            payload.report_id,
            {"aiStatus": "idle", "qaStatus": report.qa_status if report else "pending", "asrStatus": "idle"},
        )

    return ImpressionResponse(
        text=text,
        confidence=confidence,
        model="mock-impression-v1",
        generated_at=generated_at,
    )


@app.post("/api/v1/reports/qa-check", response_model=QAResponse)
async def qa_check(payload: QACheckRequest, db: Session = Depends(get_db)) -> QAResponse:
    checks, warnings, failures, score = run_qa_checks(payload.findings_text, payload.impression_text)
    passes = len(failures) == 0
    status = "pass"
    if failures:
        status = "fail"
    elif warnings:
        status = "warn"

    if payload.report_id:
        report = db.get(Report, payload.report_id)
        if report:
            report.qa_status = status
            report.qa_warnings = warnings
            report.updated_at = utc_now()
            db.commit()

        qa_result = QACheckResult(
            report_id=payload.report_id,
            status=status,
            checks=[check.model_dump() for check in checks],
            warnings=warnings,
            failures=failures,
            quality_score=score,
            created_at=utc_now(),
        )
        db.add(qa_result)
        db.commit()

        await broadcast_status(
            payload.report_id,
            {"qaStatus": status, "aiStatus": "idle", "asrStatus": "idle"},
        )

    return QAResponse(
        passes=passes,
        failures=failures,
        warnings=warnings,
        quality_score=score,
        checks=checks,
    )


@app.post("/api/v1/inference/queue", response_model=InferenceQueueResponse)
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
    model_version = payload.model_version or os.getenv("INFERENCE_MODEL_VERSION", "mock-medgemma-0.1")
    input_hash = compute_input_hash(study_id, findings_text)
    queued_at = utc_now()

    job_id = str(uuid.uuid4())
    job_payload = {
        "job_id": job_id,
        "report_id": payload.report_id,
        "study_id": study_id,
        "findings_text": findings_text,
        "requested_by": requested_by,
        "model_version": model_version,
        "input_hash": input_hash,
    }

    queue = get_queue()
    job = queue.enqueue(
        run_inference_job,
        job_payload,
        job_id=job_id,
        job_timeout=get_inference_job_timeout(),
        result_ttl=get_inference_result_ttl(),
        failure_ttl=get_inference_result_ttl(),
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
            metadata_json={"requested_by": requested_by},
        )
    )

    db.add(
        AuditEvent(
            id=str(uuid.uuid4()),
            event_type="inference_queued",
            actor_id=requested_by,
            report_id=payload.report_id,
            study_id=study_id,
            timestamp=queued_at,
            metadata_json={
                "job_id": job_id,
                "model_version": model_version,
                "input_hash": input_hash,
            },
        )
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


@app.get("/api/v1/inference/status/{job_id}", response_model=InferenceStatusResponse)
def inference_status(job_id: str, db: Session = Depends(get_db)) -> InferenceStatusResponse:
    job_record = db.get(InferenceJob, job_id)
    if job_record:
        result = None
        if job_record.status == "finished":
            result = {
                "summary": job_record.summary_text,
                "confidence": job_record.confidence,
                "model_version": job_record.model_version,
                "completed_at": job_record.completed_at,
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


@app.post("/api/v1/audit-log", response_model=AuditEventResponse)
def create_audit_event(payload: AuditEventRequest, db: Session = Depends(get_db)) -> AuditEventResponse:
    timestamp = payload.timestamp or utc_now()
    event = AuditEvent(
        id=str(uuid.uuid4()),
        event_type=payload.event_type,
        actor_id=payload.actor_id,
        report_id=payload.report_id,
        study_id=payload.study_id,
        timestamp=timestamp,
        metadata_json=payload.metadata,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return serialize_audit_event(event)


@app.get("/api/v1/audit-log", response_model=list[AuditEventResponse])
def list_audit_events(
    study_id: str | None = None,
    report_id: str | None = None,
    db: Session = Depends(get_db),
) -> list[AuditEventResponse]:
    query = db.query(AuditEvent)
    if study_id:
        query = query.filter(AuditEvent.study_id == study_id)
    if report_id:
        query = query.filter(AuditEvent.report_id == report_id)
    events = query.order_by(AuditEvent.timestamp.desc()).all()
    return [serialize_audit_event(event) for event in events]


@app.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
