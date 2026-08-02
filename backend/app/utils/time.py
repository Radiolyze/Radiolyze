from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, PlainSerializer


def utc_now() -> datetime:
    """The current instant, timezone-aware and in UTC.

    Every timestamp column in ``app.models`` is written through this, so the
    stored values share one clock and one timezone.
    """
    return datetime.now(UTC)


def now_iso() -> str:
    """The current instant as an ISO-8601 string.

    For payloads that are not database columns — WebSocket envelopes, JSON
    metadata, response fields with no model behind them.
    """
    return datetime.now(UTC).isoformat()


def ensure_utc(value: datetime) -> datetime:
    """Read a datetime as UTC, assuming naive values already are.

    Values loaded through :class:`app.utils.sqltypes.UTCDateTime` are already
    aware; this covers the ones that arrive from elsewhere (RQ job metadata,
    parsed request payloads) before they are compared or serialized.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def format_datetime(value: datetime | str | None) -> str | None:
    if not value:
        return None
    if isinstance(value, str):
        return value
    return ensure_utc(value).isoformat()


def parse_datetime(value: datetime | str | None) -> datetime | None:
    """Coerce an ISO-8601 string (or datetime) to an aware UTC datetime.

    Accepts a trailing ``Z``, which clients send even though
    ``datetime.fromisoformat`` only learned to parse it in Python 3.11.
    Returns ``None`` for input that is not a timestamp at all, so callers can
    fall back rather than fail — a malformed client-supplied timestamp should
    not become a 500.
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return ensure_utc(value)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return ensure_utc(parsed)


IsoDateTime = Annotated[
    datetime,
    AfterValidator(ensure_utc),
    PlainSerializer(lambda value: value.isoformat(), return_type=str),
]
"""A timestamp field on the API boundary.

The database columns are ``timestamptz`` (see ``app.utils.sqltypes``) but the
API contract is unchanged: these fields still validate from and serialize to
ISO-8601 strings with an explicit ``+00:00`` offset, byte-for-byte what the
handlers emitted when the columns were ``String``. Pydantic's own datetime
serializer would render UTC as a trailing ``Z`` instead — harmless to
``new Date()``, but a wire change this migration has no reason to make.
"""
