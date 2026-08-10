"""Tests for the WebSocket heartbeat and idle disconnect (issue #106).

The endpoint used to sit in an unbounded ``receive_text()`` loop, so a
half-open connection was only noticed when a broadcast happened to fail — and
never at all on a connection nothing was broadcast to. These pin the ping, the
idle close and the client-driven pong.
"""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from app.api.ws import (
    WS_CLOSE_IDLE_TIMEOUT,
    heartbeat_interval_seconds,
    idle_timeout_seconds,
    query_token_allowed,
)
from app.auth import AUTH_COOKIE_NAME, create_access_token

# Short enough to keep the suite fast, long enough that a slow CI runner does
# not trip the idle close while a test is still setting up.
FAST_HEARTBEAT = {"WS_HEARTBEAT_INTERVAL_SECONDS": "0.05", "WS_IDLE_TIMEOUT_SECONDS": "5"}


def _token_for(user_id: str) -> str:
    return create_access_token({"sub": user_id, "username": user_id, "role": "radiologist"})


def test_server_pings_an_idle_connection(client):
    with patch.dict(os.environ, FAST_HEARTBEAT):
        with client.websocket_connect("/api/v1/ws") as ws:
            assert ws.receive_json() == {"type": "ping"}
            # Not a one-off: the heartbeat keeps running.
            assert ws.receive_json() == {"type": "ping"}


def test_client_ping_gets_a_pong(client):
    """Either side can drive the heartbeat."""
    with patch.dict(os.environ, {"WS_HEARTBEAT_INTERVAL_SECONDS": "0"}):
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.send_json({"type": "ping"})
            assert ws.receive_json() == {"type": "pong"}


def test_idle_connection_is_closed_with_the_idle_code(client):
    with patch.dict(
        os.environ,
        {"WS_HEARTBEAT_INTERVAL_SECONDS": "0", "WS_IDLE_TIMEOUT_SECONDS": "0.05"},
    ):
        with client.websocket_connect("/api/v1/ws") as ws:
            message = ws.receive()
            assert message["type"] == "websocket.close"
            assert message["code"] == WS_CLOSE_IDLE_TIMEOUT


def test_traffic_keeps_a_connection_open(client):
    """A client that answers is not disconnected."""
    with patch.dict(
        os.environ,
        {"WS_HEARTBEAT_INTERVAL_SECONDS": "0.05", "WS_IDLE_TIMEOUT_SECONDS": "0.4"},
    ):
        with client.websocket_connect("/api/v1/ws") as ws:
            for _ in range(6):
                assert ws.receive_json() == {"type": "ping"}
                ws.send_json({"type": "pong"})
            # Past the idle timeout in wall-clock terms, still connected.
            ws.send_json({"type": "ping"})
            assert ws.receive_json() == {"type": "pong"}


def test_non_json_traffic_is_ignored_but_counts_as_activity(client):
    """Garbage must not crash the loop, and it still proves the client is alive."""
    with patch.dict(
        os.environ,
        {"WS_HEARTBEAT_INTERVAL_SECONDS": "0.05", "WS_IDLE_TIMEOUT_SECONDS": "5"},
    ):
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.send_text("not json at all")
            ws.send_json({"type": "ping"})
            assert ws.receive_json() == {"type": "pong"}


def test_real_events_still_arrive_alongside_the_heartbeat(client):
    """The heartbeat must not displace what the connection exists to deliver."""
    with patch.dict(
        os.environ,
        {"WS_HEARTBEAT_INTERVAL_SECONDS": "0.05", "WS_IDLE_TIMEOUT_SECONDS": "5"},
    ):
        with client.websocket_connect("/api/v1/ws") as ws:
            report_id = client.post(
                "/api/v1/reports/create",
                json={"study_id": "study-ws", "patient_id": "patient-ws"},
            ).json()["id"]
            response = client.post(
                f"/api/v1/reports/{report_id}/finalize",
                json={"approvedBy": "Dr. Test"},
            )
            assert response.status_code == 200

            # The report_status broadcast may be interleaved with pings.
            for _ in range(10):
                message = ws.receive_json()
                if message["type"] == "report_status":
                    assert message["reportId"] == report_id
                    break
                assert message == {"type": "ping"}
            else:
                raise AssertionError("no report_status event arrived")


def test_disconnect_removes_the_connection_from_the_manager(client):
    from app.ws_manager import manager

    with patch.dict(os.environ, {"WS_HEARTBEAT_INTERVAL_SECONDS": "0"}):
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.send_json({"type": "ping"})
            assert ws.receive_json() == {"type": "pong"}
        assert manager._connections == set()


class TestHeartbeatSettings:
    def test_defaults(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("WS_HEARTBEAT_INTERVAL_SECONDS", None)
            os.environ.pop("WS_IDLE_TIMEOUT_SECONDS", None)
            assert heartbeat_interval_seconds() == 30.0
            assert idle_timeout_seconds() == 120.0

    @pytest.mark.parametrize("raw", ["", "   ", "abc", "30s"])
    def test_unusable_values_fall_back_to_the_default(self, raw):
        """A typo in a deployment's env must not take the endpoint down."""
        with patch.dict(os.environ, {"WS_HEARTBEAT_INTERVAL_SECONDS": raw}):
            assert heartbeat_interval_seconds() == 30.0

    def test_values_are_read_from_the_environment(self):
        with patch.dict(
            os.environ,
            {"WS_HEARTBEAT_INTERVAL_SECONDS": "5", "WS_IDLE_TIMEOUT_SECONDS": "15"},
        ):
            assert heartbeat_interval_seconds() == 5.0
            assert idle_timeout_seconds() == 15.0


class TestQueryTokenDeprecation:
    def test_allowed_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("WS_ALLOW_QUERY_TOKEN", None)
            assert query_token_allowed() is True

    @pytest.mark.parametrize("raw", ["false", "FALSE", "0", "no"])
    def test_opt_out_values(self, raw):
        with patch.dict(os.environ, {"WS_ALLOW_QUERY_TOKEN": raw}):
            assert query_token_allowed() is False

    def test_query_token_is_rejected_when_switched_off(self, client):
        with patch.dict(
            os.environ,
            {"AUTH_REQUIRED": "true", "WS_ALLOW_QUERY_TOKEN": "false"},
        ):
            client.cookies.clear()
            token = _token_for("user-query")
            with pytest.raises(Exception):
                with client.websocket_connect(f"/api/v1/ws?token={token}"):
                    pass

    def test_cookie_still_works_when_query_token_is_switched_off(self, client):
        with patch.dict(
            os.environ,
            {
                "AUTH_REQUIRED": "true",
                "WS_ALLOW_QUERY_TOKEN": "false",
                "WS_HEARTBEAT_INTERVAL_SECONDS": "0",
            },
        ):
            client.cookies.set(AUTH_COOKIE_NAME, _token_for("user-cookie"))
            with client.websocket_connect("/api/v1/ws") as ws:
                ws.send_json({"type": "ping"})
                assert ws.receive_json() == {"type": "pong"}
            client.cookies.clear()

    def test_query_token_use_is_logged_as_deprecated(self, client, caplog):
        with patch.dict(
            os.environ,
            {"AUTH_REQUIRED": "true", "WS_HEARTBEAT_INTERVAL_SECONDS": "0"},
        ):
            client.cookies.clear()
            with caplog.at_level("WARNING", logger="app.api.ws"):
                with client.websocket_connect(f"/api/v1/ws?token={_token_for('user-query')}"):
                    pass
            assert any("deprecated" in record.message for record in caplog.records)
