from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..deps import get_db
from ..inference_clients import generate_impression_text, transcribe_audio
from ..mock_logic import run_qa_checks, utc_now
from ..models import InferenceJob, QACheckResult, Report
from ..schemas import (
    ASRResponse,
    ImpressionRequest,
    ImpressionResponse,
    QACheckRequest,
    QAResponse,
    ReportCreateRequest,
    ReportFinalizeRequest,
    ReportResponse,
    ReportUpdateRequest,
)
from ..sr import build_sr_export
from ..utils.hashing import compute_bytes_hash, compute_input_hash, compute_text_hash
from ..utils.inference import build_image_metadata, build_output_summary
from ..ws_manager import broadcast_status

router = APIRouter()


def _get_latest_inference_job(db: Session, report_id: str | None) -> InferenceJob | None:
    if not report_id:
        return None
    return (
        db.query(InferenceJob)
        .filter(InferenceJob.report_id == report_id)
        .order_by(InferenceJob.queued_at.desc())
        .first()
    )


def _serialize_report(report: Report, inference_job: InferenceJob | None = None) -> ReportResponse:
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


@router.post("/api/v1/reports/create", response_model=ReportResponse)
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
    inference_job = _get_latest_inference_job(db, report.id)
    return _serialize_report(report, inference_job)


@router.get("/api/v1/reports", response_model=list[ReportResponse])
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
    return [_serialize_report(report, _get_latest_inference_job(db, report.id)) for report in reports]


@router.get("/api/v1/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)) -> ReportResponse:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    inference_job = _get_latest_inference_job(db, report.id)
    return _serialize_report(report, inference_job)


@router.patch("/api/v1/reports/{report_id}", response_model=ReportResponse)
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

    inference_job = _get_latest_inference_job(db, report.id)
    return _serialize_report(report, inference_job)


@router.post("/api/v1/reports/{report_id}/finalize", response_model=ReportResponse)
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
    inference_job = _get_latest_inference_job(db, report.id)

    await broadcast_status(
        report_id,
        {"qaStatus": report.qa_status, "aiStatus": "idle", "asrStatus": "idle"},
    )
    return _serialize_report(report, inference_job)


@router.get("/api/v1/reports/{report_id}/export-sr")
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


@router.post("/api/v1/reports/asr-transcript", response_model=ASRResponse)
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
            {
                "asrStatus": "processing",
                "asrConfidence": confidence,
                "aiStatus": "idle",
                "qaStatus": report.qa_status if report else "pending",
            },
        )

    return ASRResponse(text=text, confidence=confidence, timestamp=timestamp)


@router.post("/api/v1/reports/generate-impression", response_model=ImpressionResponse)
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


@router.post("/api/v1/reports/qa-check", response_model=QAResponse)
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
