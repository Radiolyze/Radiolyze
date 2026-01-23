from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..ws_manager import manager

router = APIRouter()


@router.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
