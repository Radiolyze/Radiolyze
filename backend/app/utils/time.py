from __future__ import annotations

from datetime import UTC, datetime


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def format_datetime(value: datetime | str | None) -> str | None:
    if not value:
        return None
    if isinstance(value, str):
        return value
    return value.isoformat()
