from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Response, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from rq.exceptions import NoSuchJobError
from rq.job import Job
from sqlalchemy import func
from sqlalchemy.orm import Session

from .audit import add_audit_event
from .db import Base, SessionLocal, engine
from .inference_clients import generate_impression_text, transcribe_audio
from .mock_logic import run_qa_checks, utc_now
from .models import AuditEvent, DriftSnapshot, InferenceJob, QACheckResult, Report
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
    PromptListResponse,
    PromptTemplateResponse,
    PromptUpdateRequest,
    PromptType,
    ReportCreateRequest,
    ReportFinalizeRequest,
    ReportUpdateRequest,
    ReportResponse,
)
from .sr import build_sr_export
from .tasks import run_inference_job
from .ws import ConnectionManager
from .ws_events import run_ws_bridge
from .prompts import (
    ALLOWED_VARIABLES,
    PROMPT_TYPES,
    get_prompt_template,
    list_prompt_templates,
    prompt_config_enabled,
    prompt_max_length,
    template_fingerprint,
    update_prompt_template,
)

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


def compute_input_hash(
    study_id: str | None,
    findings_text: str | None,
    image_urls: list[str] | None = None,
    image_paths: list[str] | None = None,
    image_refs: list[dict[str, Any]] | None = None,
) -> str:
    normalized_urls = [url.strip() for url in (image_urls or []) if url and url.strip()]
    normalized_paths = [path.strip() for path in (image_paths or []) if path and path.strip()]
    normalized_refs = json.dumps(image_refs or [], sort_keys=True)
    raw = "|".join(
        [
            study_id or "",
            (findings_text or "").strip(),
            ",".join(normalized_urls),
            ",".join(normalized_paths),
            normalized_refs,
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_text_hash(*values: str | None) -> str:
    normalized = [value.strip() for value in values if value and value.strip()]
    raw = "|".join(normalized)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_bytes_hash(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def build_output_summary(text: str | None, limit: int = 240) -> str | None:
    if not text:
        return None
    normalized = text.strip()
    if not normalized:
        return None
    return normalized[:limit]


def get_inference_job_timeout() -> int:
    return int(os.getenv("INFERENCE_JOB_TIMEOUT", "600"))


def get_inference_result_ttl() -> int:
    return int(os.getenv("INFERENCE_RESULT_TTL", "3600"))


def get_model_version() -> str:
    return os.getenv("INFERENCE_MODEL_VERSION") or os.getenv("VLLM_MODEL_NAME", "mock-medgemma-0.1")


def build_image_metadata(
    image_urls: list[str] | None,
    image_paths: list[str] | None,
    image_refs: list[dict[str, Any]] | None = None,
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


def format_datetime(value: datetime | str | None) -> str | None:
    if not value:
        return None
    if isinstance(value, str):
        return value
    return value.isoformat()


def counts_to_dict(rows: list[tuple[str | None, int]]) -> dict[str, int]:
    result: dict[str, int] = {}
    for key, count in rows:
        label = key or "unknown"
        result[label] = count
    return result


def get_threshold(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def calculate_median(values: list[float]) -> float | None:
    if not values:
        return None
    sorted_values = sorted(values)
    midpoint = len(sorted_values) // 2
    if len(sorted_values) % 2 == 1:
        return sorted_values[midpoint]
    return (sorted_values[midpoint - 1] + sorted_values[midpoint]) / 2


def summarize_inference_jobs(jobs: list[InferenceJob]) -> dict[str, Any]:
    total = len(jobs)
    status_counts: dict[str, int] = {}
    confidences: list[float] = []
    for job in jobs:
        status = job.status or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1
        if job.confidence is not None:
            confidences.append(float(job.confidence))

    average_confidence = sum(confidences) / len(confidences) if confidences else None
    failed_count = status_counts.get("failed", 0)
    failure_rate = failed_count / total if total else None

    return {
        "total": total,
        "status_counts": status_counts,
        "confidence_avg": average_confidence,
        "confidence_median": calculate_median(confidences),
        "failure_rate": failure_rate,
    }


def summarize_qa_results(results: list[QACheckResult]) -> dict[str, Any]:
    total = len(results)
    status_counts: dict[str, int] = {}
    quality_scores: list[float] = []
    for result in results:
        status = result.status or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1
        if result.quality_score is not None:
            quality_scores.append(float(result.quality_score))

    pass_count = status_counts.get("pass", 0)
    pass_rate = pass_count / total if total else None
    average_score = sum(quality_scores) / len(quality_scores) if quality_scores else None

    return {
        "total": total,
        "status_counts": status_counts,
        "pass_rate": pass_rate,
        "quality_score_avg": average_score,
    }


def compute_deltas(current: dict[str, Any], baseline: dict[str, Any], keys: list[str]) -> dict[str, float | None]:
    deltas: dict[str, float | None] = {}
    for key in keys:
        current_value = current.get(key)
        baseline_value = baseline.get(key)
        if current_value is None or baseline_value is None:
            deltas[key] = None
        else:
            deltas[key] = float(current_value) - float(baseline_value)
    return deltas


def get_latest_inference_job(db: Session, report_id: str | None) -> InferenceJob | None:
    if not report_id:
        return None
    return (
        db.query(InferenceJob)
        .filter(InferenceJob.report_id == report_id)
        .order_by(InferenceJob.queued_at.desc())
        .first()
    )


def serialize_report(report: Report, inference_job: InferenceJob | None = None) -> ReportResponse:
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
        inference_status=inference_job.status if inference_job else None,
        inference_summary=inference_job.summary_text if inference_job else None,
        inference_confidence=inference_job.confidence if inference_job else None,
        inference_model_version=inference_job.model_version if inference_job else None,
        inference_job_id=inference_job.id if inference_job else None,
        inference_completed_at=inference_job.completed_at if inference_job else None,
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


def serialize_prompt(template: dict[str, Any]) -> PromptTemplateResponse:
    prompt_type = template["prompt_type"]
    allowed = sorted(ALLOWED_VARIABLES[prompt_type])
    return PromptTemplateResponse(
        promptType=prompt_type,
        name=template["name"],
        templateText=template["template_text"],
        version=template.get("version"),
        isActive=bool(template.get("is_active", True)),
        variables=template.get("variables") or [],
        createdBy=template.get("created_by"),
        createdAt=template.get("created_at"),
        updatedAt=template.get("updated_at"),
        source=template.get("source", "default"),
        defaultText=template.get("default_text", ""),
        editable=prompt_config_enabled(),
        maxLength=prompt_max_length(),
        allowedVariables=allowed,
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
    add_audit_event(
        db,
        event_type="report_created",
        actor_id="system",
        report_id=report_id,
        study_id=payload.study_id,
        metadata={"status": report.status},
        timestamp=now,
        source="api",
    )
    db.commit()
    db.refresh(report)
    inference_job = get_latest_inference_job(db, report.id)
    return serialize_report(report, inference_job)


@app.get("/api/v1/reports", response_model=list[ReportResponse])
def list_reports(
    status: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[ReportResponse]:
    query = db.query(Report)
    if status:
        query = query.filter(Report.status == status)
    reports = query.order_by(Report.created_at.desc()).offset(offset).limit(limit).all()
    return [serialize_report(report, get_latest_inference_job(db, report.id)) for report in reports]


@app.get("/api/v1/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)) -> ReportResponse:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    inference_job = get_latest_inference_job(db, report.id)
    return serialize_report(report, inference_job)


@app.patch("/api/v1/reports/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: str,
    payload: ReportUpdateRequest,
    db: Session = Depends(get_db),
) -> ReportResponse:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    updated_fields: list[str] = []
    if payload.findings_text is not None:
        report.findings_text = payload.findings_text
        updated_fields.append("findings_text")
    if payload.impression_text is not None:
        report.impression_text = payload.impression_text
        updated_fields.append("impression_text")
    if payload.status is not None:
        report.status = payload.status
        updated_fields.append("status")

    if updated_fields:
        now = utc_now()
        report.updated_at = now
        if payload.status is None and report.status in {"pending", "in_progress"}:
            report.status = "draft"

        event_type = "report_updated"
        if "findings_text" in updated_fields:
            event_type = "findings_saved"
        elif "impression_text" in updated_fields:
            event_type = "report_amended"

        add_audit_event(
            db,
            event_type=event_type,
            actor_id=payload.actor_id,
            report_id=report_id,
            study_id=report.study_id,
            metadata={"updated_fields": updated_fields},
            timestamp=now,
            source="api",
        )
        db.commit()
        db.refresh(report)

        if payload.status is None and report.status in {"draft", "pending", "in_progress"}:
            await broadcast_status(
                report_id,
                {"qaStatus": report.qa_status, "aiStatus": "idle", "asrStatus": "idle"},
            )

    inference_job = get_latest_inference_job(db, report.id)
    return serialize_report(report, inference_job)


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
    approver = payload.approved_by or payload.signature
    report.status = "finalized"
    report.approved_at = now
    report.approved_by = approver
    report.updated_at = now

    add_audit_event(
        db,
        event_type="report_approved",
        actor_id=approver,
        report_id=report_id,
        study_id=report.study_id,
        metadata={"signature": approver} if approver else None,
        timestamp=now,
        source="api",
    )
    db.commit()
    db.refresh(report)
    inference_job = get_latest_inference_job(db, report.id)

    await broadcast_status(
        report_id,
        {"qaStatus": report.qa_status, "aiStatus": "idle", "asrStatus": "idle"},
    )
    return serialize_report(report, inference_job)


@app.get("/api/v1/reports/{report_id}/export-sr")
def export_structured_report(
    report_id: str,
    actor_id: str | None = None,
    export_format: str = Query("json", alias="format"),
    db: Session = Depends(get_db),
) -> Response:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    normalized = export_format.lower()
    if normalized not in {"json", "dicom"}:
        raise HTTPException(status_code=400, detail="Unsupported SR export format")

    content, filename, media_type = build_sr_export(report, normalized)
    add_audit_event(
        db,
        event_type="report_exported",
        actor_id=actor_id or report.approved_by,
        report_id=report.id,
        study_id=report.study_id,
        metadata={"format": normalized, "file_name": filename},
        source="api",
    )
    db.commit()

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/v1/reports/asr-transcript", response_model=ASRResponse)
async def asr_transcript(
    file: UploadFile = File(...),
    report_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> ASRResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio payload")
    try:
        text, confidence, model_name, metadata = await transcribe_audio(
            content=content,
            filename=file.filename or "audio.wav",
            content_type=file.content_type,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    timestamp = utc_now()

    audio_hash = compute_bytes_hash(content)
    output_summary = f"transcript_length={len(text)}"

    report = None
    if report_id:
        report = db.get(Report, report_id)
        if report:
            report.updated_at = timestamp
        metadata_payload = {
            "confidence": confidence,
            "transcript_length": len(text),
            "model_version": model_name,
            "input_hash": audio_hash,
            "output_summary": output_summary,
        }
        if metadata:
            metadata_payload.update(metadata)
        add_audit_event(
            db,
            event_type="asr_transcription",
            actor_id=None,
            report_id=report_id,
            study_id=report.study_id if report else None,
            metadata=metadata_payload,
            timestamp=timestamp,
            source="api",
        )
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
    try:
        text, confidence, model_name, metadata = generate_impression_text(
            payload.findings_text,
            image_urls=payload.image_urls,
            image_paths=payload.image_paths,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    generated_at = utc_now()

    report = None
    if payload.report_id:
        report = db.get(Report, payload.report_id)
        if report:
            report.impression_text = text
            report.updated_at = generated_at
            if report.status in {"pending", "in_progress"}:
                report.status = "draft"
        input_hash = compute_input_hash(
            report.study_id if report else None,
            payload.findings_text,
            payload.image_urls,
            payload.image_paths,
        )
        output_summary = build_output_summary(text)
        image_metadata = build_image_metadata(payload.image_urls, payload.image_paths, None)
        metadata_payload = {
            "model_version": model_name,
            "model": model_name,
            "confidence": confidence,
            "pipeline": "impression_service",
            "input_hash": input_hash,
            "output_summary": output_summary,
            **image_metadata,
        }
        if metadata:
            metadata_payload.update(metadata)
        add_audit_event(
            db,
            event_type="impression_generated",
            actor_id="system",
            report_id=payload.report_id,
            study_id=report.study_id if report else None,
            metadata=metadata_payload,
            timestamp=generated_at,
            source="api",
        )
        db.commit()

        await broadcast_status(
            payload.report_id,
            {"aiStatus": "idle", "qaStatus": report.qa_status if report else "pending", "asrStatus": "idle"},
        )

    return ImpressionResponse(
        text=text,
        confidence=confidence,
        model=model_name,
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
        now = utc_now()
        if report:
            report.qa_status = status
            report.qa_warnings = warnings
            report.updated_at = now

        qa_result = QACheckResult(
            report_id=payload.report_id,
            status=status,
            checks=[check.model_dump() for check in checks],
            warnings=warnings,
            failures=failures,
            quality_score=score,
            created_at=now,
        )
        db.add(qa_result)
        input_hash = compute_text_hash(payload.findings_text, payload.impression_text)
        output_summary = f"{status} (warnings={len(warnings)}, failures={len(failures)})"
        add_audit_event(
            db,
            event_type="qa_check_run",
            actor_id="system",
            report_id=payload.report_id,
            study_id=report.study_id if report else None,
            metadata={
                "model_version": "qa-rules-v1",
                "engine": "rules",
                "engine_version": "qa-rules-v1",
                "status": status,
                "warnings_count": len(warnings),
                "failures_count": len(failures),
                "checks_count": len(checks),
                "quality_score": score,
                "input_hash": input_hash,
                "output_summary": output_summary,
            },
            timestamp=now,
            source="api",
        )
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
    image_urls = payload.image_urls or []
    image_paths = payload.image_paths or []
    image_refs = [ref.model_dump() for ref in (payload.image_refs or [])]
    model_version = payload.model_version or get_model_version()
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


@app.get("/api/v1/inference/status/{job_id}", response_model=InferenceStatusResponse)
def inference_status(job_id: str, db: Session = Depends(get_db)) -> InferenceStatusResponse:
    job_record = db.get(InferenceJob, job_id)
    if job_record:
        result = None
        if job_record.status == "finished":
            image_refs = None
            if isinstance(job_record.metadata_json, dict):
                image_refs = job_record.metadata_json.get("image_refs")
            result = {
                "summary": job_record.summary_text,
                "confidence": job_record.confidence,
                "model_version": job_record.model_version,
                "completed_at": job_record.completed_at,
                "image_refs": image_refs,
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


@app.get("/api/v1/prompts", response_model=PromptListResponse)
def list_prompts(db: Session = Depends(get_db)) -> PromptListResponse:
    prompts = list_prompt_templates(db=db)
    return PromptListResponse(
        editable=prompt_config_enabled(),
        maxLength=prompt_max_length(),
        allowedVariables={ptype: sorted(ALLOWED_VARIABLES[ptype]) for ptype in PROMPT_TYPES},
        prompts=[serialize_prompt(prompt) for prompt in prompts],
    )


@app.get("/api/v1/prompts/{prompt_type}", response_model=PromptTemplateResponse)
def get_prompt(prompt_type: PromptType, db: Session = Depends(get_db)) -> PromptTemplateResponse:
    template = get_prompt_template(prompt_type, db=db)
    return serialize_prompt(template)


@app.put("/api/v1/prompts/{prompt_type}", response_model=PromptTemplateResponse)
def update_prompt(
    prompt_type: PromptType,
    payload: PromptUpdateRequest,
    db: Session = Depends(get_db),
) -> PromptTemplateResponse:
    if not prompt_config_enabled():
        raise HTTPException(status_code=403, detail="Prompt configuration disabled")
    try:
        template = update_prompt_template(
            db,
            prompt_type=prompt_type,
            template_text=payload.template_text,
            name=payload.name,
            actor_id=payload.actor_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    add_audit_event(
        db,
        event_type="prompt_updated",
        actor_id=payload.actor_id,
        metadata={
            "prompt_type": prompt_type,
            "version": template.get("version"),
            "variables": template.get("variables") or [],
            "template_hash": template_fingerprint(payload.template_text),
            "template_length": len(payload.template_text),
        },
        source="api",
    )
    db.commit()

    return serialize_prompt(template)


@app.post("/api/v1/audit-log", response_model=AuditEventResponse)
def create_audit_event(payload: AuditEventRequest, db: Session = Depends(get_db)) -> AuditEventResponse:
    timestamp = payload.timestamp or utc_now()
    event = add_audit_event(
        db,
        event_type=payload.event_type,
        actor_id=payload.actor_id,
        report_id=payload.report_id,
        study_id=payload.study_id,
        metadata=payload.metadata,
        timestamp=timestamp,
        source="client",
    )
    db.commit()
    db.refresh(event)
    return serialize_audit_event(event)


@app.get("/api/v1/audit-log", response_model=list[AuditEventResponse])
def list_audit_events(
    study_id: str | None = None,
    report_id: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[AuditEventResponse]:
    query = db.query(AuditEvent)
    if study_id:
        query = query.filter(AuditEvent.study_id == study_id)
    if report_id:
        query = query.filter(AuditEvent.report_id == report_id)
    events = query.order_by(AuditEvent.timestamp.desc()).offset(offset).limit(limit).all()
    return [serialize_audit_event(event) for event in events]


@app.get("/api/v1/metrics")
def get_metrics(db: Session = Depends(get_db)) -> dict[str, Any]:
    reports_total = db.query(func.count(Report.id)).scalar() or 0
    reports_by_status = counts_to_dict(
        db.query(Report.status, func.count(Report.id)).group_by(Report.status).all()
    )
    qa_status_counts = counts_to_dict(
        db.query(Report.qa_status, func.count(Report.id)).group_by(Report.qa_status).all()
    )
    inference_job_counts = counts_to_dict(
        db.query(InferenceJob.status, func.count(InferenceJob.id)).group_by(InferenceJob.status).all()
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


@app.get("/api/v1/monitoring/drift")
def get_drift_report(
    window_days: int = Query(7, ge=1, le=90),
    baseline_days: int | None = Query(None, ge=1, le=365),
    persist: bool = Query(False),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    baseline_days = baseline_days or window_days
    window_start = now - timedelta(days=window_days)
    baseline_start = window_start - timedelta(days=baseline_days)

    window_start_iso = window_start.isoformat()
    window_end_iso = now.isoformat()
    baseline_start_iso = baseline_start.isoformat()
    baseline_end_iso = window_start_iso

    current_jobs = (
        db.query(InferenceJob)
        .filter(InferenceJob.completed_at >= window_start_iso, InferenceJob.completed_at < window_end_iso)
        .all()
    )
    baseline_jobs = (
        db.query(InferenceJob)
        .filter(InferenceJob.completed_at >= baseline_start_iso, InferenceJob.completed_at < baseline_end_iso)
        .all()
    )
    current_qa = (
        db.query(QACheckResult)
        .filter(QACheckResult.created_at >= window_start_iso, QACheckResult.created_at < window_end_iso)
        .all()
    )
    baseline_qa = (
        db.query(QACheckResult)
        .filter(QACheckResult.created_at >= baseline_start_iso, QACheckResult.created_at < baseline_end_iso)
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

    if confidence_delta is not None and abs(confidence_delta) >= get_threshold("DRIFT_CONFIDENCE_DELTA", 0.1):
        alerts.append(
            {
                "metric": "inference.confidence_avg",
                "delta": confidence_delta,
                "threshold": get_threshold("DRIFT_CONFIDENCE_DELTA", 0.1),
            }
        )
    if failure_delta is not None and abs(failure_delta) >= get_threshold("DRIFT_INFERENCE_FAILURE_DELTA", 0.05):
        alerts.append(
            {
                "metric": "inference.failure_rate",
                "delta": failure_delta,
                "threshold": get_threshold("DRIFT_INFERENCE_FAILURE_DELTA", 0.05),
            }
        )
    if pass_rate_delta is not None and abs(pass_rate_delta) >= get_threshold("DRIFT_QA_PASS_RATE_DELTA", 0.1):
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
            source="api",
        )
        if alerts:
            add_audit_event(
                db,
                event_type="drift_alert_triggered",
                actor_id="system",
                metadata={"snapshot_id": snapshot_id, "alerts": alerts},
                source="api",
            )
        db.commit()

    return response_payload


@app.get("/api/v1/monitoring/drift/snapshots")
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


@app.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
