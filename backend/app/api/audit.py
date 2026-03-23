from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..deps import get_db
from ..mock_logic import utc_now
from ..models import AuditEvent
from ..schemas import AuditEventRequest, AuditEventResponse

router = APIRouter()


def _serialize_audit_event(event: AuditEvent) -> AuditEventResponse:
    return AuditEventResponse(
        id=event.id,
        event_type=event.event_type,
        actor_id=event.actor_id,
        report_id=event.report_id,
        study_id=event.study_id,
        timestamp=event.timestamp,
        metadata=event.metadata_json,
    )


@router.post("/api/v1/audit-log", response_model=AuditEventResponse)
def create_audit_event(
    payload: AuditEventRequest, db: Session = Depends(get_db)
) -> AuditEventResponse:
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
    return _serialize_audit_event(event)


@router.get("/api/v1/audit-log", response_model=list[AuditEventResponse])
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
    return [_serialize_audit_event(event) for event in events]
