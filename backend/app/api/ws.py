from __future__ import annotations

import logging
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..auth import decode_access_token
from ..ws_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


def _authenticate_ws(token: str | None) -> str | None:
    """Validate a JWT token and return the user_id, or None if invalid."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        return payload.get("sub")
    except Exception:
        return None


@router.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None) -> None:
    auth_required = os.getenv("AUTH_REQUIRED", "true").lower() == "true"
    user_id = _authenticate_ws(token)

    if auth_required and not user_id:
        await websocket.close(code=4401, reason="Authentication required")
        return

    await manager.connect(websocket, user_id=user_id)
    logger.info("WS connected user=%s", user_id or "anonymous")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WS disconnected user=%s", user_id or "anonymous")
