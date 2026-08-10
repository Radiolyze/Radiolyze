from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..auth import AUTH_COOKIE_NAME, decode_access_token
from ..ws_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)

# Application-level heartbeat. Protocol-level ping/pong frames are answered by
# the ASGI server itself and never surface to the app, so they prove the socket
# is open but not that anything above it is still alive. These frames travel the
# same path as real events, which is what we actually want to keep verified.
PING_MESSAGE = {"type": "ping"}
PONG_MESSAGE = {"type": "pong"}

# Sent when a connection is closed for going quiet past WS_IDLE_TIMEOUT_SECONDS.
# In the 4000-4999 application range; mirrors HTTP 408. Clients should treat it
# as a normal, retryable disconnect rather than an auth failure.
WS_CLOSE_IDLE_TIMEOUT = 4408


def _authenticate_ws(token: str | None) -> str | None:
    """Validate a JWT token and return the user_id, or None if invalid."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        return payload.get("sub")
    except Exception:
        return None


def _env_seconds(name: str, default: float) -> float:
    """Read a duration from the environment, falling back on anything unusable.

    A malformed value must not take the WebSocket endpoint down, so a bad
    setting is logged and the default is used.
    """
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        logger.warning("Ignoring invalid %s=%r, using %s", name, raw, default)
        return default


def heartbeat_interval_seconds() -> float:
    """Idle time before the server sends a ping. <= 0 disables the heartbeat."""
    return _env_seconds("WS_HEARTBEAT_INTERVAL_SECONDS", 30.0)


def idle_timeout_seconds() -> float:
    """Silence tolerated before the connection is closed. <= 0 disables it."""
    return _env_seconds("WS_IDLE_TIMEOUT_SECONDS", 120.0)


def query_token_allowed() -> bool:
    """Whether the deprecated ``?token=`` query parameter is still accepted."""
    return os.getenv("WS_ALLOW_QUERY_TOKEN", "true").strip().lower() not in {
        "0",
        "false",
        "no",
    }


async def _handle_client_message(websocket: WebSocket, raw: str) -> None:
    """Answer a client-initiated ping so either side can drive the heartbeat."""
    try:
        message = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return
    if isinstance(message, dict) and message.get("type") == "ping":
        await websocket.send_json(PONG_MESSAGE)


@router.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None) -> None:
    auth_required = os.getenv("AUTH_REQUIRED", "true").lower() == "true"
    # Prefer the HttpOnly auth cookie (sent automatically by the browser on
    # the WS handshake) over the deprecated `?token=` query param, which leaks
    # into proxy/access logs. The query param is kept as a fallback for
    # non-browser clients that can't rely on cookies, and can be switched off
    # entirely with WS_ALLOW_QUERY_TOKEN=false once they have migrated.
    cookie_token = websocket.cookies.get(AUTH_COOKIE_NAME)
    query_token = token if query_token_allowed() else None
    if token and query_token is None:
        logger.warning("Rejected WS `?token=` query param: WS_ALLOW_QUERY_TOKEN is off")

    user_id = _authenticate_ws(cookie_token or query_token)

    if auth_required and not user_id:
        await websocket.close(code=4401, reason="Authentication required")
        return

    if user_id and not cookie_token and query_token:
        client = websocket.client.host if websocket.client else "unknown"
        logger.warning(
            "WS authenticated via deprecated `?token=` query param "
            "(user=%s client=%s); migrate to the auth cookie",
            user_id,
            client,
        )

    await manager.connect(websocket, user_id=user_id)
    logger.info("WS connected user=%s", user_id or "anonymous")

    heartbeat = heartbeat_interval_seconds()
    idle_timeout = idle_timeout_seconds()
    loop = asyncio.get_running_loop()
    last_seen = loop.time()

    # The receive is a task rather than an `asyncio.wait_for`, so that a
    # heartbeat tick leaves it pending instead of cancelling it mid-await —
    # a cancelled receive can drop a message that had already arrived.
    receive_task = asyncio.create_task(websocket.receive_text())
    try:
        while True:
            # The two knobs are independent: with the heartbeat off, the idle
            # timeout still needs a tick to be noticed on; with both off the
            # loop just waits for the client, as it did before heartbeats.
            if heartbeat > 0:
                timeout = heartbeat
            elif idle_timeout > 0:
                timeout = idle_timeout
            else:
                timeout = None
            await asyncio.wait({receive_task}, timeout=timeout)

            if receive_task.done():
                raw = receive_task.result()  # re-raises WebSocketDisconnect
                last_seen = loop.time()
                receive_task = asyncio.create_task(websocket.receive_text())
                await _handle_client_message(websocket, raw)
                continue

            idle_for = loop.time() - last_seen
            if 0 < idle_timeout <= idle_for:
                logger.info(
                    "WS idle timeout user=%s after %.0fs",
                    user_id or "anonymous",
                    idle_for,
                )
                await websocket.close(code=WS_CLOSE_IDLE_TIMEOUT, reason="Idle timeout")
                break

            if heartbeat > 0:
                await websocket.send_json(PING_MESSAGE)
    except WebSocketDisconnect:
        logger.info("WS disconnected user=%s", user_id or "anonymous")
    except Exception as exc:
        # A send on a half-open socket surfaces here; the connection is gone
        # either way, so it is cleaned up rather than left in the manager.
        logger.info("WS closed user=%s: %s", user_id or "anonymous", exc)
    finally:
        receive_task.cancel()
        # Awaited so the receive is actually torn down before the endpoint
        # returns; a pending task outliving its connection scope logs a
        # "Task was destroyed but it is pending" on the way out.
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await receive_task
        manager.disconnect(websocket)
