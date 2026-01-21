from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from .mock_logic import utc_now
from .models import AuditEvent


def add_audit_event(
    db: Session,
    *,
    event_type: str,
    actor_id: str | None = None,
    report_id: str | None = None,
    study_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    timestamp: str | None = None,
    source: str | None = None,
) -> AuditEvent:
    metadata_payload = dict(metadata or {})
    if source and "source" not in metadata_payload:
        metadata_payload["source"] = source

    event = AuditEvent(
        id=str(uuid.uuid4()),
        event_type=event_type,
        actor_id=actor_id,
        report_id=report_id,
        study_id=study_id,
        timestamp=timestamp or utc_now(),
        metadata_json=metadata_payload or None,
    )
    db.add(event)
    return event
