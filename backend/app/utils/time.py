from __future__ import annotations

from datetime import datetime, timezone


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def format_datetime(value: datetime | str | None) -> str | None:
    if not value:
        return None
    if isinstance(value, str):
        return value
    return value.isoformat()
