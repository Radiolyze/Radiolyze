from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from .models import AuditEvent
from .utils.hashing import compute_audit_event_hash
from .utils.time import parse_datetime, utc_now

# Stable 64-bit key for the advisory lock below - the ASCII bytes of
# "AUDITSEQ", so the holder is recognisable in ``pg_locks``.
_AUDIT_SEQ_LOCK_KEY = int.from_bytes(b"AUDITSEQ", "big", signed=True)


def _lock_audit_chain(db: Session) -> None:
    """Serialise audit appends for the rest of the caller's transaction.

    ``seq``/``prev_hash`` are derived from the current tail of the chain, so
    two requests that read the same tail concurrently both build an event with
    the same ``seq`` and the loser dies on ``ix_audit_events_seq`` (taking its
    whole transaction - the report it was auditing included - with it). A
    transaction-level advisory lock makes the read-then-insert atomic: the
    second writer waits until the first commits and then reads the real tail,
    or - if the first rolled back - reads the same tail and reuses the seq, so
    the chain stays gap-free either way.

    Postgres only. SQLite (dev/tests) has no advisory locks; it serialises
    writers at the file level, which leaves the same read-then-insert window,
    but no concurrent-writer deployment runs on it.
    """
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _AUDIT_SEQ_LOCK_KEY})


def add_audit_event(
    db: Session,
    *,
    event_type: str,
    actor_id: str | None = None,
    report_id: str | None = None,
    study_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    timestamp: datetime | str | None = None,
    source: str | None = None,
) -> AuditEvent:
    """Append a new tamper-evident audit event.

    Each event is linked to its predecessor through a SHA-256 hash chain
    (``seq``/``prev_hash``/``event_hash``) so that editing or deleting a row
    afterwards is detectable via :func:`verify_audit_chain`.

    Does NOT commit. The event is flushed (so it's visible to the next
    ``add_audit_event`` call in the same transaction, keeping the chain
    consistent even across multiple events per request) but the caller owns
    the commit - if the caller's transaction rolls back, this event rolls
    back with it.

    Takes an advisory lock on the chain (see :func:`_lock_audit_chain`) that
    is likewise held until the caller commits or rolls back, so concurrent
    appends queue up instead of colliding on ``seq``.
    """
    metadata_payload = dict(metadata or {})
    if source and "source" not in metadata_payload:
        metadata_payload["source"] = source

    # A caller may still hand in an ISO string (the audit-log endpoint takes
    # one from the client); parse it so the column always receives a datetime,
    # and fall back to now for anything unparseable rather than 500.
    event_timestamp = parse_datetime(timestamp) or utc_now()

    _lock_audit_chain(db)
    last_event = db.query(AuditEvent).order_by(AuditEvent.seq.desc()).first()
    seq = (last_event.seq + 1) if last_event else 1
    prev_hash = last_event.event_hash if last_event else None

    event_hash = compute_audit_event_hash(
        seq=seq,
        prev_hash=prev_hash,
        event_type=event_type,
        actor_id=actor_id,
        report_id=report_id,
        study_id=study_id,
        timestamp=event_timestamp,
        metadata=metadata_payload or None,
    )

    event = AuditEvent(
        id=str(uuid.uuid4()),
        seq=seq,
        event_type=event_type,
        actor_id=actor_id,
        report_id=report_id,
        study_id=study_id,
        timestamp=event_timestamp,
        metadata_json=metadata_payload or None,
        prev_hash=prev_hash,
        event_hash=event_hash,
    )
    db.add(event)
    db.flush()
    return event


def verify_audit_chain(db: Session) -> tuple[bool, list[int]]:
    """Recompute the hash chain and report any breaks.

    Returns ``(is_valid, broken_seqs)`` where ``broken_seqs`` lists the
    ``seq`` of every event whose stored hash no longer matches what its
    fields (and its predecessor's hash) recompute to - i.e. every event that
    was edited, deleted, or reordered after being written, plus the first
    surviving event after any gap.
    """
    events = db.query(AuditEvent).order_by(AuditEvent.seq.asc()).all()
    broken: list[int] = []
    expected_prev_hash: str | None = None
    for event in events:
        recomputed = compute_audit_event_hash(
            seq=event.seq,
            prev_hash=event.prev_hash,
            event_type=event.event_type,
            actor_id=event.actor_id,
            report_id=event.report_id,
            study_id=event.study_id,
            timestamp=event.timestamp,
            metadata=event.metadata_json,
        )
        if event.prev_hash != expected_prev_hash or recomputed != event.event_hash:
            broken.append(event.seq)
        # Chain forward on the recomputed (true) hash, not the possibly
        # stale stored value, so a tampered row's descendants are flagged
        # too even though their own stored prev_hash still matches the old
        # (pre-tamper) hash.
        expected_prev_hash = recomputed
    return (len(broken) == 0, broken)
