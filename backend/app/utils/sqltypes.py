from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator):
    """A ``DateTime(timezone=True)`` that is timezone-aware on every backend.

    PostgreSQL stores ``timestamptz`` and hands back an aware value, but in
    whatever timezone the session happens to be in; SQLite has no timestamp
    type at all and hands back a naive value with the offset silently dropped.
    Both are trouble for the same reason: application code that compares a
    stored timestamp against ``datetime.now(UTC)`` either compares across
    timezones or raises ``TypeError: can't compare offset-naive and
    offset-aware datetimes``, and which one you get depends on the database.

    This normalises both ends of the round trip, so a value read back is
    always aware and always in UTC:

    - on the way in, a naive value is assumed to be UTC and an aware one is
      converted to UTC;
    - on the way out, the value is tagged (SQLite) or converted (PostgreSQL)
      to UTC.

    That also makes ``.isoformat()`` on a loaded value deterministic — it
    always ends in ``+00:00`` — which the audit hash chain depends on
    (``app.utils.hashing.compute_audit_event_hash``).
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if not isinstance(value, datetime):
            raise TypeError(f"expected datetime, got {type(value).__name__}: {value!r}")
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def process_result_value(self, value: Any, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
