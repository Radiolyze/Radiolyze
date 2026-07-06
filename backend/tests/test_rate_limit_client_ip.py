"""Tests for the rate limiter's proxy-aware client IP resolution."""

from __future__ import annotations

import os
from unittest.mock import patch

from starlette.requests import Request

from app.main import _get_client_ip


def _make_request(headers: dict[str, str], client_host: str | None = "10.0.0.1") -> Request:
    scope = {
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": (client_host, 12345) if client_host else None,
    }
    return Request(scope)


def test_ignores_forwarded_headers_by_default():
    request = _make_request({"x-forwarded-for": "203.0.113.1, 10.0.0.1"})
    with patch.dict(os.environ, {"RATE_LIMIT_TRUST_PROXY_HEADERS": ""}, clear=False):
        assert _get_client_ip(request) == "10.0.0.1"


def test_uses_leftmost_forwarded_for_when_trusted():
    request = _make_request({"x-forwarded-for": "203.0.113.1, 198.51.100.2"})
    with patch.dict(os.environ, {"RATE_LIMIT_TRUST_PROXY_HEADERS": "true"}, clear=False):
        assert _get_client_ip(request) == "203.0.113.1"


def test_falls_back_to_x_real_ip_when_trusted():
    request = _make_request({"x-real-ip": "203.0.113.9"})
    with patch.dict(os.environ, {"RATE_LIMIT_TRUST_PROXY_HEADERS": "1"}, clear=False):
        assert _get_client_ip(request) == "203.0.113.9"


def test_falls_back_to_direct_client_when_trusted_but_no_headers_present():
    request = _make_request({})
    with patch.dict(os.environ, {"RATE_LIMIT_TRUST_PROXY_HEADERS": "yes"}, clear=False):
        assert _get_client_ip(request) == "10.0.0.1"


def test_returns_unknown_when_no_client_and_not_trusted():
    request = _make_request({}, client_host=None)
    with patch.dict(os.environ, {"RATE_LIMIT_TRUST_PROXY_HEADERS": ""}, clear=False):
        assert _get_client_ip(request) == "unknown"
