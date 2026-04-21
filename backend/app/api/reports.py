from __future__ import annotations

import os
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..deps import get_db, require_admin, require_radiologist_or_admin
from ..inference_clients import generate_impression_stream, generate_impression_text, transcribe_audio
from ..mock_logic import run_qa_checks, utc_now
from ..models import (
    CriticalFindingAlert,
    InferenceJob,
    PeerReview,
    QACheckResult,
    Report,
    ReportRevision,
)
from ..schemas import (
    ASRResponse,
    CriticalFindingAcknowledgeRequest,
    CriticalFindingAlertResponse,
    ImpressionRequest,
    ImpressionResponse,
    PeerReviewRequest,
    PeerReviewResponse,
    PeerReviewSubmitRequest,
    QACheckRequest,
    QAResponse,
    ReportCreateRequest,
    ReportFinalizeRequest,
    ReportResponse,
    ReportRevisionResponse,
    ReportUpdateRequest,
)
from ..dicom_client import store_sr
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
        structured_data=getattr(report, "structured_data", None),
        inference_status=inference_job.status if inference_job else None,
        inference_summary=inference_job.summary_text if inference_job else None,
        inference_confidence=inference_job.confidence if inference_job else None,
        inference_model_version=inference_job.model_version if inference_job else None,
        inference_job_id=inference_job.id if inference_job else None,
        inference_completed_at=inference_job.completed_at if inference_job else None,
    )


@router.post("/api/v1/reports/create", response_model=ReportResponse)
def create_report(
    payload: ReportCreateRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> ReportResponse:
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
    return [
        _serialize_report(report, _get_latest_inference_job(db, report.id)) for report in reports
    ]


@router.get("/api/v1/reports/by-patient/{patient_id}", response_model=list[ReportResponse])
def list_reports_by_patient(
    patient_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[ReportResponse]:
    """List all reports for a patient, sorted by creation date (newest first)."""
    reports = (
        db.query(Report)
        .filter(Report.patient_id == patient_id)
        .order_by(Report.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_serialize_report(r, _get_latest_inference_job(db, r.id)) for r in reports]


def _compute_etag(report: Report) -> str:
    """Compute ETag from report's updated_at timestamp."""
    import hashlib

    return hashlib.sha256(report.updated_at.encode()).hexdigest()[:16]


@router.get("/api/v1/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)) -> Response:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    inference_job = _get_latest_inference_job(db, report.id)
    data = _serialize_report(report, inference_job)
    response = Response(
        content=data.model_dump_json(),
        media_type="application/json",
        headers={"ETag": f'"{_compute_etag(report)}"'},
    )
    return response


@router.patch("/api/v1/reports/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: str,
    payload: ReportUpdateRequest,
    request: Request = None,
    db: Session = Depends(get_db),
) -> ReportResponse:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # ETag-based conflict detection (If-Match header)
    if request:
        if_match = request.headers.get("If-Match")
        if if_match:
            current_etag = f'"{_compute_etag(report)}"'
            if if_match.strip('" ') != current_etag.strip('" '):
                raise HTTPException(
                    status_code=409,
                    detail="Conflict: report was modified by another user",
                )

    # Capture old state for revision
    old_findings = report.findings_text
    old_impression = report.impression_text

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
    if payload.structured_data is not None:
        report.structured_data = payload.structured_data
        updated_fields.append("structured_data")

    if updated_fields:
        now = utc_now()

        # Create revision snapshot of previous state
        revision = ReportRevision(
            report_id=report_id,
            findings_text=old_findings,
            impression_text=old_impression,
            changed_by=payload.actor_id,
            changed_at=now,
        )
        db.add(revision)

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
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> ReportResponse:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status == "finalized":
        raise HTTPException(status_code=409, detail="Report already finalized")

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

    # Archive DICOM SR to Orthanc via STOW-RS when binary format is requested
    orthanc_url: str | None = None
    if normalized == "dicom" and isinstance(content, (bytes, bytearray)):
        try:
            orthanc_url = store_sr(report.study_id, bytes(content))
            report.dicom_sr_orthanc_url = orthanc_url
        except RuntimeError as exc:
            import logging as _log
            _log.getLogger(__name__).warning("STOW-RS archival failed (non-fatal): %s", exc)

    add_audit_event(
        db,
        event_type="report_exported",
        actor_id=actor_id or report.approved_by,
        report_id=report.id,
        study_id=report.study_id,
        metadata={
            "format": normalized,
            "file_name": filename,
            "orthanc_url": orthanc_url,
        },
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
    language: str | None = Form(
        default=None,
        description="BCP-47 or ISO-639-1 hint for ASR (e.g. de-DE, en).",
    ),
    db: Session = Depends(get_db),
) -> ASRResponse:
    max_audio_size = int(
        os.environ.get("ASR_MAX_FILE_SIZE", str(25 * 1024 * 1024))
    )  # 25 MB default
    content = await file.read(max_audio_size + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio payload")
    if len(content) > max_audio_size:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file too large (max {max_audio_size // (1024 * 1024)} MB)",
        )
    try:
        text, confidence, model_name, metadata = await transcribe_audio(
            content=content,
            filename=file.filename or "audio.wav",
            content_type=file.content_type,
            language=language,
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
            "asr_language_requested": language,
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
    import asyncio

    try:
        loop = asyncio.get_running_loop()
        text, confidence, model_name, metadata = await loop.run_in_executor(
            None,
            lambda: generate_impression_text(
                payload.findings_text,
                image_urls=payload.image_urls,
                image_paths=payload.image_paths,
            ),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    generated_at = utc_now()

    report = None
    if payload.report_id:
        report = db.get(Report, payload.report_id)
        if not report:
            raise HTTPException(
                status_code=404,
                detail=f"Report {payload.report_id} not found; impression was generated but not persisted",
            )
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
            {
                "aiStatus": "idle",
                "qaStatus": report.qa_status if report else "pending",
                "asrStatus": "idle",
            },
        )

    return ImpressionResponse(
        text=text,
        confidence=confidence,
        model=model_name,
        generated_at=generated_at,
        metadata=metadata,
    )


@router.post("/api/v1/reports/stream-impression")
async def stream_impression_endpoint(
    payload: ImpressionRequest,
    _: None = require_radiologist_or_admin,
) -> StreamingResponse:
    """Stream impression generation tokens via Server-Sent Events (SSE).

    The client receives lines of the form ``data: <token>\\n\\n``.
    The stream ends with ``data: [DONE]\\n\\n``.
    """

    async def _event_stream():
        try:
            async for token in generate_impression_stream(
                payload.findings_text,
                image_urls=payload.image_urls,
                image_refs=getattr(payload, "image_refs", None),
            ):
                # Escape newlines within a token to keep SSE framing intact
                escaped = token.replace("\n", "\\n")
                yield f"data: {escaped}\n\n"
        except Exception as exc:
            logger.error("SSE impression stream error: %s", exc)
        finally:
            yield "data: [DONE]\n\n"

    import logging as _logging
    logger = _logging.getLogger(__name__)

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/v1/reports/qa-check", response_model=QAResponse)
async def qa_check(payload: QACheckRequest, db: Session = Depends(get_db)) -> QAResponse:
    # Use configurable rules if any exist, otherwise fall back to hardcoded logic
    from ..models import QARule
    from ..qa_engine import evaluate_rules

    active_rules = db.query(QARule).filter(QARule.is_active).all()
    if active_rules:
        checks, warnings, failures, score = evaluate_rules(
            active_rules,
            payload.findings_text or "",
            payload.impression_text or "",
        )
    else:
        checks, warnings, failures, score = run_qa_checks(
            payload.findings_text, payload.impression_text
        )
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


@router.get("/api/v1/reports/{report_id}/revisions", response_model=list[ReportRevisionResponse])
def list_revisions(
    report_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[ReportRevisionResponse]:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    revisions = (
        db.query(ReportRevision)
        .filter(ReportRevision.report_id == report_id)
        .order_by(ReportRevision.changed_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ReportRevisionResponse(
            id=r.id,
            report_id=r.report_id,
            findings_text=r.findings_text,
            impression_text=r.impression_text,
            changed_by=r.changed_by,
            changed_at=r.changed_at,
            change_reason=r.change_reason,
        )
        for r in revisions
    ]


@router.get("/api/v1/reports/{report_id}/export-pdf")
def export_pdf(
    report_id: str,
    actor_id: str | None = None,
    db: Session = Depends(get_db),
) -> Response:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    from ..pdf_export import build_pdf_export

    try:
        pdf_bytes, filename = build_pdf_export(report)
    except RuntimeError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc

    add_audit_event(
        db,
        event_type="report_exported",
        actor_id=actor_id or report.approved_by,
        report_id=report.id,
        study_id=report.study_id,
        metadata={"format": "pdf", "file_name": filename},
        source="api",
    )
    db.commit()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Critical Finding Alerts
# ---------------------------------------------------------------------------


@router.post(
    "/api/v1/reports/{report_id}/check-critical",
    response_model=list[CriticalFindingAlertResponse],
)
async def check_critical_findings(
    report_id: str,
    db: Session = Depends(get_db),
) -> list[CriticalFindingAlertResponse]:
    """Scan a report for critical findings and create alerts."""
    from ..models import QARule
    from ..qa_engine import detect_critical_findings

    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    rules = db.query(QARule).filter(QARule.is_active).all()
    detected = detect_critical_findings(report.findings_text, report.impression_text, rules)

    alerts: list[CriticalFindingAlertResponse] = []
    now = utc_now()

    for item in detected:
        alert = CriticalFindingAlert(
            report_id=report_id,
            finding_type=item["finding_type"],
            severity=item["severity"],
            matched_text=item.get("matched_text"),
            notified_at=now,
        )
        db.add(alert)
        db.flush()
        add_audit_event(
            db,
            event_type="critical_finding_detected",
            actor_id="system",
            report_id=report_id,
            study_id=report.study_id,
            metadata={
                "alert_id": alert.id,
                "finding_type": item["finding_type"],
                "severity": item["severity"],
            },
            timestamp=now,
            source="api",
        )
        alerts.append(
            CriticalFindingAlertResponse(
                id=alert.id,
                report_id=report_id,
                finding_type=alert.finding_type,
                severity=alert.severity,
                matched_text=alert.matched_text,
                notified_at=now,
            )
        )

    db.commit()

    if alerts:
        await broadcast_status(
            report_id,
            {"criticalAlerts": [a.model_dump() for a in alerts]},
        )

    return alerts


@router.get(
    "/api/v1/reports/{report_id}/critical-alerts",
    response_model=list[CriticalFindingAlertResponse],
)
def list_critical_alerts(
    report_id: str,
    db: Session = Depends(get_db),
) -> list[CriticalFindingAlertResponse]:
    alerts = (
        db.query(CriticalFindingAlert)
        .filter(CriticalFindingAlert.report_id == report_id)
        .order_by(CriticalFindingAlert.notified_at.desc())
        .all()
    )
    return [
        CriticalFindingAlertResponse(
            id=a.id,
            report_id=a.report_id,
            finding_type=a.finding_type,
            severity=a.severity,
            matched_text=a.matched_text,
            notified_at=a.notified_at,
            acknowledged_by=a.acknowledged_by,
            acknowledged_at=a.acknowledged_at,
        )
        for a in alerts
    ]


@router.patch(
    "/api/v1/reports/{report_id}/critical-alerts/{alert_id}/acknowledge",
    response_model=CriticalFindingAlertResponse,
)
def acknowledge_critical_alert(
    report_id: str,
    alert_id: str,
    payload: CriticalFindingAcknowledgeRequest,
    db: Session = Depends(get_db),
) -> CriticalFindingAlertResponse:
    alert = db.get(CriticalFindingAlert, alert_id)
    if not alert or alert.report_id != report_id:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.acknowledged_at:
        raise HTTPException(status_code=409, detail="Alert already acknowledged")

    now = utc_now()
    alert.acknowledged_by = payload.acknowledged_by
    alert.acknowledged_at = now

    add_audit_event(
        db,
        event_type="critical_finding_acknowledged",
        actor_id=payload.acknowledged_by,
        report_id=report_id,
        metadata={"alert_id": alert_id, "finding_type": alert.finding_type},
        timestamp=now,
        source="api",
    )
    db.commit()

    return CriticalFindingAlertResponse(
        id=alert.id,
        report_id=alert.report_id,
        finding_type=alert.finding_type,
        severity=alert.severity,
        matched_text=alert.matched_text,
        notified_at=alert.notified_at,
        acknowledged_by=alert.acknowledged_by,
        acknowledged_at=alert.acknowledged_at,
    )


# ---------------------------------------------------------------------------
# Peer Review / Second Opinion
# ---------------------------------------------------------------------------


@router.post(
    "/api/v1/reports/{report_id}/request-review",
    response_model=PeerReviewResponse,
)
async def request_peer_review(
    report_id: str,
    payload: PeerReviewRequest,
    db: Session = Depends(get_db),
) -> PeerReviewResponse:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    now = utc_now()
    review = PeerReview(
        report_id=report_id,
        requested_by="system",
        assigned_to=payload.assigned_to,
        comment=payload.comment,
        status="requested",
        created_at=now,
    )
    db.add(review)
    add_audit_event(
        db,
        event_type="peer_review_requested",
        actor_id="system",
        report_id=report_id,
        study_id=report.study_id,
        metadata={
            "assigned_to": payload.assigned_to,
            "comment": payload.comment,
        },
        timestamp=now,
        source="api",
    )
    db.commit()
    db.refresh(review)

    await broadcast_status(report_id, {"peerReviewStatus": "requested"})

    return PeerReviewResponse(
        id=review.id,
        report_id=review.report_id,
        requested_by=review.requested_by,
        assigned_to=review.assigned_to,
        comment=review.comment,
        status=review.status,
        created_at=review.created_at,
    )


@router.get(
    "/api/v1/reports/{report_id}/reviews",
    response_model=list[PeerReviewResponse],
)
def list_peer_reviews(
    report_id: str,
    db: Session = Depends(get_db),
) -> list[PeerReviewResponse]:
    reviews = (
        db.query(PeerReview)
        .filter(PeerReview.report_id == report_id)
        .order_by(PeerReview.created_at.desc())
        .all()
    )
    return [
        PeerReviewResponse(
            id=r.id,
            report_id=r.report_id,
            requested_by=r.requested_by,
            assigned_to=r.assigned_to,
            comment=r.comment,
            review_comment=r.review_comment,
            status=r.status,
            decision=r.decision,
            created_at=r.created_at,
            completed_at=r.completed_at,
        )
        for r in reviews
    ]


@router.post(
    "/api/v1/reports/{report_id}/reviews/{review_id}/submit",
    response_model=PeerReviewResponse,
)
async def submit_peer_review(
    report_id: str,
    review_id: str,
    payload: PeerReviewSubmitRequest,
    db: Session = Depends(get_db),
) -> PeerReviewResponse:
    review = db.get(PeerReview, review_id)
    if not review or review.report_id != report_id:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.status == "completed":
        raise HTTPException(status_code=409, detail="Review already completed")

    now = utc_now()
    review.review_comment = payload.review_comment
    review.decision = payload.decision
    review.status = "completed"
    review.completed_at = now

    report = db.get(Report, report_id)
    add_audit_event(
        db,
        event_type="peer_review_submitted",
        actor_id=review.assigned_to,
        report_id=report_id,
        study_id=report.study_id if report else None,
        metadata={
            "review_id": review_id,
            "decision": payload.decision,
        },
        timestamp=now,
        source="api",
    )
    db.commit()

    await broadcast_status(
        report_id, {"peerReviewStatus": "completed", "peerReviewDecision": payload.decision}
    )

    return PeerReviewResponse(
        id=review.id,
        report_id=review.report_id,
        requested_by=review.requested_by,
        assigned_to=review.assigned_to,
        comment=review.comment,
        review_comment=review.review_comment,
        status=review.status,
        decision=review.decision,
        created_at=review.created_at,
        completed_at=review.completed_at,
    )
