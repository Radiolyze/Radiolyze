from __future__ import annotations

import os

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
from starlette.concurrency import run_in_threadpool

from ..audit import add_audit_event
from ..deps import get_current_user, get_db, require_radiologist_or_admin
from ..dicom_client import store_sr
from ..inference_clients import (
    generate_impression_stream,
    generate_impression_text,
    transcribe_audio,
)
from ..mock_logic import run_qa_checks
from ..models import (
    InferenceJob,
    QACheckResult,
    Report,
    ReportComparison,
    ReportRevision,
    User,
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
    ReportComparisonCreateRequest,
    ReportComparisonResponse,
    ReportCreateRequest,
    ReportFinalizeRequest,
    ReportResponse,
    ReportRevisionResponse,
    ReportUpdateRequest,
)
from ..services import CriticalFindingService, PeerReviewService, ReportService
from ..services.exceptions import ConflictError, NotFoundError
from ..sr import build_sr_export
from ..utils.hashing import compute_bytes_hash, compute_input_hash, compute_text_hash
from ..utils.inference import build_image_metadata, build_output_summary
from ..utils.time import utc_now
from ..ws_manager import broadcast_status

router = APIRouter()


# Thin module-level facades delegating to ReportService, kept so the many
# call sites below (and any external references) stay stable. The canonical
# logic lives in app.services.report_service.
def _get_latest_inference_job(db: Session, report_id: str | None) -> InferenceJob | None:
    return ReportService(db).get_latest_inference_job(report_id)


def _get_latest_inference_jobs(db: Session, report_ids: list[str]) -> dict[str, InferenceJob]:
    return ReportService(db).get_latest_inference_jobs(report_ids)


def _serialize_report(report: Report, inference_job: InferenceJob | None = None) -> ReportResponse:
    return ReportService.serialize(report, inference_job)


@router.post("/api/v1/reports/create", response_model=ReportResponse)
def create_report(
    payload: ReportCreateRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> ReportResponse:
    service = ReportService(db)
    report = service.create(payload)
    return service.serialize_one(report)


@router.get("/api/v1/reports", response_model=list[ReportResponse])
def list_reports(
    status: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> list[ReportResponse]:
    service = ReportService(db)
    reports = service.list(status=status, limit=limit, offset=offset)
    return service.serialize_many(reports)


@router.get("/api/v1/reports/by-patient/{patient_id}", response_model=list[ReportResponse])
def list_reports_by_patient(
    patient_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> list[ReportResponse]:
    """List all reports for a patient, sorted by creation date (newest first)."""
    service = ReportService(db)
    reports = service.list_by_patient(patient_id, limit=limit, offset=offset)
    return service.serialize_many(reports)


def _compute_etag(report: Report) -> str:
    """Compute ETag from report's updated_at timestamp (delegates to ReportService)."""
    return ReportService.compute_etag(report)


@router.get("/api/v1/reports/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: str,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> Response:
    service = ReportService(db)
    report = service.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    data = service.serialize_one(report)
    response = Response(
        content=data.model_dump_json(),
        media_type="application/json",
        headers={"ETag": f'"{ReportService.compute_etag(report)}"'},
    )
    return response


@router.patch("/api/v1/reports/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: str,
    payload: ReportUpdateRequest,
    request: Request = None,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> ReportResponse:
    # Actor is the authenticated caller when available; the client-supplied
    # payload.actor_id is only a dev-mode fallback (AUTH_REQUIRED=false),
    # since it cannot otherwise be trusted to identify who made the change.
    actor_id = current_user.id if current_user is not None else payload.actor_id
    if_match = request.headers.get("If-Match") if request else None

    def _update_sync() -> tuple[ReportResponse, bool, str | None]:
        service = ReportService(db)
        try:
            report, should_broadcast, qa_status = service.update(
                report_id, payload, actor_id=actor_id, if_match=if_match
            )
        except NotFoundError as exc:
            raise HTTPException(status_code=404, detail="Report not found") from exc
        except ConflictError as exc:
            raise HTTPException(status_code=409, detail=f"Conflict: {exc}") from exc

        inference_job = _get_latest_inference_job(db, report.id)
        return _serialize_report(report, inference_job), should_broadcast, qa_status

    response, should_broadcast, qa_status = await run_in_threadpool(_update_sync)

    if should_broadcast:
        await broadcast_status(
            report_id,
            {"qaStatus": qa_status, "aiStatus": "idle", "asrStatus": "idle"},
        )

    return response


@router.post("/api/v1/reports/{report_id}/finalize", response_model=ReportResponse)
async def finalize_report(
    report_id: str,
    payload: ReportFinalizeRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> ReportResponse:
    service = ReportService(db)
    try:
        report = service.finalize(report_id, payload)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail="Report not found") from exc
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

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
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> Response:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Authenticated caller wins over the (client-controlled) actor_id query
    # param, which remains only as a dev-mode/back-compat fallback.
    audit_actor_id = (
        current_user.id if current_user is not None else (actor_id or report.approved_by)
    )

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
        actor_id=audit_actor_id,
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
    _: None = require_radiologist_or_admin,
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
    _: None = require_radiologist_or_admin,
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
async def qa_check(
    payload: QACheckRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> QAResponse:
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
    _: None = require_radiologist_or_admin,
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


@router.post(
    "/api/v1/reports/{report_id}/comparisons",
    response_model=ReportComparisonResponse,
)
def create_comparison(
    report_id: str,
    payload: ReportComparisonCreateRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> ReportComparisonResponse:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    comparison = ReportComparison(
        current_report_id=report_id,
        prior_study_uid=payload.prior_study_uid,
        prior_series_uid=payload.prior_series_uid,
        time_delta_days=payload.time_delta_days,
        created_at=utc_now(),
    )
    db.add(comparison)
    db.commit()
    db.refresh(comparison)

    return ReportComparisonResponse(
        id=comparison.id,
        current_report_id=comparison.current_report_id,
        prior_study_uid=comparison.prior_study_uid,
        prior_series_uid=comparison.prior_series_uid,
        time_delta_days=comparison.time_delta_days,
        created_at=comparison.created_at,
    )


@router.get(
    "/api/v1/reports/{report_id}/comparisons",
    response_model=list[ReportComparisonResponse],
)
def list_comparisons(
    report_id: str,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> list[ReportComparisonResponse]:
    comparisons = (
        db.query(ReportComparison)
        .filter(ReportComparison.current_report_id == report_id)
        .order_by(ReportComparison.created_at.desc())
        .all()
    )
    return [
        ReportComparisonResponse(
            id=c.id,
            current_report_id=c.current_report_id,
            prior_study_uid=c.prior_study_uid,
            prior_series_uid=c.prior_series_uid,
            time_delta_days=c.time_delta_days,
            created_at=c.created_at,
        )
        for c in comparisons
    ]


@router.get("/api/v1/reports/{report_id}/export-pdf")
def export_pdf(
    report_id: str,
    actor_id: str | None = None,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> Response:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Authenticated caller wins over the (client-controlled) actor_id query
    # param, which remains only as a dev-mode/back-compat fallback.
    audit_actor_id = (
        current_user.id if current_user is not None else (actor_id or report.approved_by)
    )

    from ..pdf_export import build_pdf_export

    try:
        pdf_bytes, filename = build_pdf_export(report)
    except RuntimeError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc

    add_audit_event(
        db,
        event_type="report_exported",
        actor_id=audit_actor_id,
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
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> list[CriticalFindingAlertResponse]:
    """Scan a report for critical findings and create alerts."""
    try:
        created = CriticalFindingService(db).detect_and_record(report_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Report not found") from None

    alerts = [CriticalFindingService.serialize(a) for a in created]

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
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> list[CriticalFindingAlertResponse]:
    service = CriticalFindingService(db)
    return [service.serialize(a) for a in service.list_for_report(report_id)]


@router.patch(
    "/api/v1/reports/{report_id}/critical-alerts/{alert_id}/acknowledge",
    response_model=CriticalFindingAlertResponse,
)
def acknowledge_critical_alert(
    report_id: str,
    alert_id: str,
    payload: CriticalFindingAcknowledgeRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> CriticalFindingAlertResponse:
    try:
        alert = CriticalFindingService(db).acknowledge(
            report_id,
            alert_id,
            acknowledged_by=payload.acknowledged_by,
            # Audit actor is the authenticated caller; payload.acknowledged_by
            # (stored on the alert itself) is a separate, client-supplied
            # display name and isn't trusted as the audit identity.
            actor_id=current_user.id if current_user is not None else None,
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Alert not found") from None
    except ConflictError:
        raise HTTPException(status_code=409, detail="Alert already acknowledged") from None

    return CriticalFindingService.serialize(alert)


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
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> PeerReviewResponse:
    try:
        review = PeerReviewService(db).request(report_id, payload)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Report not found") from None

    await broadcast_status(report_id, {"peerReviewStatus": "requested"})

    return PeerReviewService.serialize(review)


@router.get(
    "/api/v1/reports/{report_id}/reviews",
    response_model=list[PeerReviewResponse],
)
def list_peer_reviews(
    report_id: str,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> list[PeerReviewResponse]:
    service = PeerReviewService(db)
    return [service.serialize(r) for r in service.list_for_report(report_id)]


@router.post(
    "/api/v1/reports/{report_id}/reviews/{review_id}/submit",
    response_model=PeerReviewResponse,
)
async def submit_peer_review(
    report_id: str,
    review_id: str,
    payload: PeerReviewSubmitRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> PeerReviewResponse:
    try:
        review = PeerReviewService(db).submit(report_id, review_id, payload)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Review not found") from None
    except ConflictError:
        raise HTTPException(status_code=409, detail="Review already completed") from None

    await broadcast_status(
        report_id, {"peerReviewStatus": "completed", "peerReviewDecision": payload.decision}
    )

    return PeerReviewService.serialize(review)
