from __future__ import annotations

from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        # Maps user_id -> set of websockets for targeted delivery
        self._user_connections: dict[str, set[WebSocket]] = {}
        # Maps websocket -> user_id for reverse lookup
        self._ws_user: dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, user_id: str | None = None) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        if user_id:
            self._ws_user[websocket] = user_id
            if user_id not in self._user_connections:
                self._user_connections[user_id] = set()
            self._user_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)
        user_id = self._ws_user.pop(websocket, None)
        if user_id and user_id in self._user_connections:
            self._user_connections[user_id].discard(websocket)
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]

    async def broadcast(self, message: dict[str, Any]) -> None:
        for connection in list(self._connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

    async def send_to_user(self, user_id: str, message: dict[str, Any]) -> None:
        """Send a message only to connections belonging to a specific user."""
        connections = self._user_connections.get(user_id, set())
        for connection in list(connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)
