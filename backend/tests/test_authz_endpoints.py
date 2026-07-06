"""AuthZ enforcement tests for previously-unprotected endpoints.

These endpoints were identified in issue #96 as reachable without
authentication despite exposing PHI (findings/impression text, patient/study
IDs) or gating expensive LLM/ASR operations. Each case below asserts that,
with AUTH_REQUIRED=true, an unauthenticated request is rejected with 401
before any business logic runs.
"""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

UNPROTECTED_ENDPOINTS = [
    ("GET", "/api/v1/reports/nonexistent/export-sr", None, None),
    ("GET", "/api/v1/reports/nonexistent/export-pdf", None, None),
    ("GET", "/api/v1/reports/nonexistent/revisions", None, None),
    (
        "POST",
        "/api/v1/reports/generate-impression",
        {"findings_text": "Normal chest x-ray."},
        None,
    ),
    (
        "POST",
        "/api/v1/reports/qa-check",
        {"findings_text": "x", "impression_text": "y"},
        None,
    ),
    (
        "POST",
        "/api/v1/reports/asr-transcript",
        None,
        {"file": ("audio.wav", b"RIFF....WAVEfmt ", "audio/wav")},
    ),
    ("POST", "/api/v1/reports/nonexistent/check-critical", {}, None),
    ("GET", "/api/v1/reports/nonexistent/critical-alerts", None, None),
    (
        "PATCH",
        "/api/v1/reports/nonexistent/critical-alerts/nonexistent/acknowledge",
        {"acknowledgedBy": "someone"},
        None,
    ),
    (
        "POST",
        "/api/v1/reports/nonexistent/request-review",
        {"assignedTo": "someone"},
        None,
    ),
    ("GET", "/api/v1/reports/nonexistent/reviews", None, None),
    (
        "POST",
        "/api/v1/reports/nonexistent/reviews/nonexistent/submit",
        {"reviewComment": "looks good", "decision": "agree"},
        None,
    ),
    ("GET", "/api/v1/report-templates", None, None),
    (
        "POST",
        "/api/v1/report-templates",
        {"name": "tmpl", "templateText": "text"},
        None,
    ),
    ("POST", "/api/v1/report-templates/populate", {"templateId": "nonexistent"}, None),
    ("GET", "/api/v1/report-templates/nonexistent/schema", None, None),
    ("GET", "/api/v1/metrics", None, None),
    ("GET", "/api/v1/monitoring/drift", None, None),
    ("GET", "/api/v1/monitoring/drift/snapshots", None, None),
]


@pytest.mark.parametrize("method,path,json_body,files", UNPROTECTED_ENDPOINTS)
def test_endpoint_requires_authentication(client, method, path, json_body, files):
    """Every PHI-/cost-exposing endpoint must 401 without a bearer token."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        response = client.request(method, path, json=json_body, files=files)
        assert response.status_code == 401, (
            f"{method} {path} did not require authentication "
            f"(got {response.status_code}: {response.text})"
        )
