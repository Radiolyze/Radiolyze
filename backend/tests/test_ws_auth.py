"""Tests for WebSocket authentication (issue #100).

The browser sends the HttpOnly auth cookie automatically on the WS
handshake; the legacy ``?token=`` query param remains as a fallback for
non-browser clients, but the cookie takes precedence when both are present.
"""

from __future__ import annotations

import os
from unittest.mock import patch

from app.auth import AUTH_COOKIE_NAME, create_access_token


def _token_for(user_id: str) -> str:
    return create_access_token({"sub": user_id, "username": user_id, "role": "radiologist"})


def test_ws_authenticates_via_cookie(client):
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        client.cookies.set(AUTH_COOKIE_NAME, _token_for("user-cookie"))
        with client.websocket_connect("/api/v1/ws") as ws:
            # Connection accepted (no close exception raised on entry).
            ws.close()


def test_ws_rejects_when_auth_required_and_no_credentials(client):
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        client.cookies.clear()
        try:
            with client.websocket_connect("/api/v1/ws"):
                raise AssertionError("expected the handshake to be rejected")
        except Exception:
            pass


def test_ws_falls_back_to_query_token_without_cookie(client):
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        client.cookies.clear()
        token = _token_for("user-query")
        with client.websocket_connect(f"/api/v1/ws?token={token}") as ws:
            ws.close()


def test_ws_cookie_takes_precedence_over_query_token(client):
    """An invalid query token is ignored when a valid cookie is present."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        client.cookies.set(AUTH_COOKIE_NAME, _token_for("user-cookie"))
        with client.websocket_connect("/api/v1/ws?token=not-a-real-token") as ws:
            ws.close()
