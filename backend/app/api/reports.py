from __future__ import annotations

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

from ..deps import get_current_user, get_db, require_radiologist_or_admin
from ..models import (
    InferenceJob,
    Report,
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
from ..services import (
    ComparisonService,
    CriticalFindingService,
    ExportArtifact,
    ExportService,
    ImpressionService,
    PeerReviewService,
    QAService,
    ReportService,
    TranscriptionService,
)
from ..services.exceptions import (
    ConflictError,
    FeatureUnavailableError,
    NotFoundError,
    PayloadTooLargeError,
    UpstreamError,
    ValidationError,
)
from ..ws_manager import broadcast_status

router = APIRouter()


def _attachment(artifact: ExportArtifact) -> Response:
    """Serve a rendered export as a browser download."""
    return Response(
        content=artifact.content,
        media_type=artifact.media_type,
        headers={"Content-Disposition": f'attachment; filename="{artifact.filename}"'},
    )


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
    try:
        artifact = ExportService(db).export_sr(
            report_id,
            export_format,
            current_user_id=current_user.id if current_user is not None else None,
            actor_id=actor_id,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _attachment(artifact)


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
    # One byte past the limit is enough to tell an oversize upload from an
    # acceptable one, without buffering the whole of it to find out.
    content = await file.read(TranscriptionService.max_audio_bytes() + 1)
    try:
        result = await TranscriptionService(db).transcribe(
            content=content,
            filename=file.filename or "audio.wav",
            content_type=file.content_type,
            language=language,
            report_id=report_id,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PayloadTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except UpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if result.recorded and report_id:
        await broadcast_status(
            report_id,
            {
                "asrStatus": "processing",
                "asrConfidence": result.confidence,
                "aiStatus": "idle",
                # No report row means no QA state to report on; "pending" is
                # what a report that has never been checked would say.
                "qaStatus": result.qa_status or "pending",
            },
        )

    return ASRResponse(text=result.text, confidence=result.confidence, timestamp=result.timestamp)


@router.post("/api/v1/reports/generate-impression", response_model=ImpressionResponse)
async def generate_impression_endpoint(
    payload: ImpressionRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> ImpressionResponse:
    try:
        result = await ImpressionService(db).generate(payload)
    except UpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if result.persisted and payload.report_id:
        await broadcast_status(
            payload.report_id,
            {
                "aiStatus": "idle",
                "qaStatus": result.qa_status or "pending",
                "asrStatus": "idle",
            },
        )

    return ImpressionResponse(
        text=result.text,
        confidence=result.confidence,
        model=result.model,
        generated_at=result.generated_at,
        metadata=result.metadata,
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
            async for token in ImpressionService.stream(payload):
                # Escape newlines within a token to keep SSE framing intact
                escaped = token.replace("\n", "\\n")
                yield f"data: {escaped}\n\n"
        finally:
            yield "data: [DONE]\n\n"

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
    result = QAService(db).run(payload)

    if result.persisted and payload.report_id:
        await broadcast_status(
            payload.report_id,
            {"qaStatus": result.status, "aiStatus": "idle", "asrStatus": "idle"},
        )

    return QAResponse(
        passes=result.passes,
        failures=result.failures,
        warnings=result.warnings,
        quality_score=result.quality_score,
        checks=result.checks,
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
    service = ComparisonService(db)
    try:
        comparison = service.create(report_id, payload)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return service.serialize(comparison)


@router.get(
    "/api/v1/reports/{report_id}/comparisons",
    response_model=list[ReportComparisonResponse],
)
def list_comparisons(
    report_id: str,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> list[ReportComparisonResponse]:
    service = ComparisonService(db)
    return [service.serialize(c) for c in service.list_for_report(report_id)]


@router.get("/api/v1/reports/{report_id}/export-pdf")
def export_pdf(
    report_id: str,
    actor_id: str | None = None,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> Response:
    try:
        artifact = ExportService(db).export_pdf(
            report_id,
            current_user_id=current_user.id if current_user is not None else None,
            actor_id=actor_id,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FeatureUnavailableError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc

    return _attachment(artifact)


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
