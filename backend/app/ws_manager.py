from __future__ import annotations

from typing import Any

from .utils.time import now_iso
from .ws import ConnectionManager

manager = ConnectionManager()


async def broadcast_status(report_id: str | None, payload: dict[str, Any]) -> None:
    if not report_id:
        return
    await manager.broadcast(
        {
            "type": "report_status",
            "reportId": report_id,
            "payload": payload,
            "timestamp": now_iso(),
        }
    )
