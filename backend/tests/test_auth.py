"""Tests for authentication and JWT configuration."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest


def test_validate_jwt_config_dev_default_warns(caplog):
    """In development mode, using the default secret logs a warning."""

    with patch.dict(os.environ, {"ENVIRONMENT": "development", "JWT_SECRET_KEY": ""}, clear=False):
        # Re-import is tricky; just test the function directly
        import app.auth as auth_mod

        original = auth_mod.SECRET_KEY
        auth_mod.SECRET_KEY = auth_mod._DEV_SECRET
        try:
            with caplog.at_level("WARNING"):
                auth_mod.validate_jwt_config()
            assert "default development value" in caplog.text
        finally:
            auth_mod.SECRET_KEY = original


def test_validate_jwt_config_production_rejects_default():
    """In production mode, using the default secret raises RuntimeError."""
    import app.auth as auth_mod

    original = auth_mod.SECRET_KEY
    auth_mod.SECRET_KEY = auth_mod._DEV_SECRET
    try:
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            with pytest.raises(RuntimeError, match="FATAL"):
                auth_mod.validate_jwt_config()
    finally:
        auth_mod.SECRET_KEY = original


def test_validate_jwt_config_production_rejects_short_secret():
    """In production mode, a short secret raises RuntimeError."""
    import app.auth as auth_mod

    original = auth_mod.SECRET_KEY
    auth_mod.SECRET_KEY = "short"
    try:
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            with pytest.raises(RuntimeError, match="too short"):
                auth_mod.validate_jwt_config()
    finally:
        auth_mod.SECRET_KEY = original


def test_validate_jwt_config_production_accepts_strong_secret():
    """In production mode, a sufficiently long secret passes validation."""
    import app.auth as auth_mod

    original = auth_mod.SECRET_KEY
    auth_mod.SECRET_KEY = "a" * 64
    try:
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            auth_mod.validate_jwt_config()  # Should not raise
    finally:
        auth_mod.SECRET_KEY = original


def test_login_returns_token(client, seed_admin):
    """Verify login endpoint returns a JWT token."""
    resp = client.post(
        "/api/v1/auth/login",
        json={
            "username": "testadmin",
            "password": "adminpass",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, seed_admin):
    """Verify login rejects wrong credentials."""
    resp = client.post(
        "/api/v1/auth/login",
        json={
            "username": "testadmin",
            "password": "wrongpass",
        },
    )
    assert resp.status_code == 401


def test_create_access_token_and_decode():
    """Verify token creation and decoding round-trip."""
    from app.auth import create_access_token, decode_access_token

    token = create_access_token({"sub": "user-123", "role": "admin"})
    decoded = decode_access_token(token)
    assert decoded["sub"] == "user-123"
    assert decoded["role"] == "admin"
    assert "exp" in decoded


# ---------------------------------------------------------------------------
# RBAC enforcement tests (AUTH_REQUIRED=true)
# ---------------------------------------------------------------------------

import os  # noqa: E402
from unittest.mock import patch  # noqa: E402


def _login_as(client, username: str, password: str) -> str:
    """Helper: log in and return bearer token."""
    resp = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    return resp.json()["access_token"]


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_rbac_admin_can_create_qa_rule(client, seed_admin):
    """Admin users may create QA rules."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        token = _login_as(client, "testadmin", "adminpass")
        resp = client.post(
            "/api/v1/qa-rules",
            json={"name": "min-length", "rule_type": "min_length", "config": {"min_length": 10}},
            headers=_auth_header(token),
        )
        assert resp.status_code == 201


def test_rbac_radiologist_cannot_create_qa_rule(client, seed_radiologist):
    """Radiologist users are blocked from creating QA rules."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        token = _login_as(client, "testradiologist", "radiopass")
        resp = client.post(
            "/api/v1/qa-rules",
            json={"name": "min-length", "rule_type": "min_length", "config": {"min_length": 10}},
            headers=_auth_header(token),
        )
        assert resp.status_code == 403


def test_rbac_admin_can_delete_qa_rule(client, seed_admin):
    """Admin users may delete QA rules."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        token = _login_as(client, "testadmin", "adminpass")
        # Create a rule first
        create = client.post(
            "/api/v1/qa-rules",
            json={"name": "tmp-rule", "rule_type": "min_length", "config": {"min_length": 5}},
            headers=_auth_header(token),
        )
        assert create.status_code == 201
        rule_id = create.json()["id"]
        # Now delete it
        resp = client.delete(f"/api/v1/qa-rules/{rule_id}", headers=_auth_header(token))
        assert resp.status_code == 204


def test_rbac_radiologist_cannot_update_prompt(client, seed_radiologist):
    """Radiologist users are blocked from updating prompt templates."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        token = _login_as(client, "testradiologist", "radiopass")
        resp = client.put(
            "/api/v1/prompts/impression",
            json={"template_text": "New template {{findings_text}}"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 403


def test_rbac_admin_can_update_prompt(client, seed_admin):
    """Admin users may update prompt templates when PROMPT_CONFIG_ENABLED=true."""
    with patch.dict(
        os.environ, {"AUTH_REQUIRED": "true", "PROMPT_CONFIG_ENABLED": "true"}
    ):
        token = _login_as(client, "testadmin", "adminpass")
        resp = client.put(
            "/api/v1/prompts/impression",
            json={"template_text": "New template {{findings_text}}"},
            headers=_auth_header(token),
        )
        # 200 (success) or 400 (template validation) — either way not 403
        assert resp.status_code != 403


def test_rbac_radiologist_can_create_report(client, seed_radiologist):
    """Radiologist users may create reports."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        token = _login_as(client, "testradiologist", "radiopass")
        resp = client.post(
            "/api/v1/reports/create",
            json={"study_id": "study-rbac", "patient_id": "patient-rbac"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200


def test_rbac_unauthenticated_blocked_from_report_create(client):
    """Unauthenticated requests are rejected when AUTH_REQUIRED=true."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        resp = client.post(
            "/api/v1/reports/create",
            json={"study_id": "study-x", "patient_id": "patient-x"},
        )
        assert resp.status_code == 401


def test_rbac_admin_can_export_training_data(client, seed_admin):
    """Admin users may trigger training data export."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        token = _login_as(client, "testadmin", "adminpass")
        resp = client.post(
            "/api/v1/training/export",
            json={"format": "coco"},
            headers=_auth_header(token),
        )
        # 200 (empty export ok) or any non-403 response is acceptable
        assert resp.status_code != 403


def test_rbac_radiologist_cannot_export_training_data(client, seed_radiologist):
    """Radiologist users are blocked from training data export."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        token = _login_as(client, "testradiologist", "radiopass")
        resp = client.post(
            "/api/v1/training/export",
            json={"format": "coco"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 403
