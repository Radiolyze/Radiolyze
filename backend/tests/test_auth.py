"""Tests for authentication and JWT configuration."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest


def test_validate_jwt_config_dev_default_warns(caplog):
    """In development mode, using the default secret logs a warning."""
    from app.auth import validate_jwt_config

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
    resp = client.post("/api/v1/auth/login", json={
        "username": "testadmin",
        "password": "adminpass",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, seed_admin):
    """Verify login rejects wrong credentials."""
    resp = client.post("/api/v1/auth/login", json={
        "username": "testadmin",
        "password": "wrongpass",
    })
    assert resp.status_code == 401


def test_create_access_token_and_decode():
    """Verify token creation and decoding round-trip."""
    from app.auth import create_access_token, decode_access_token

    token = create_access_token({"sub": "user-123", "role": "admin"})
    decoded = decode_access_token(token)
    assert decoded["sub"] == "user-123"
    assert decoded["role"] == "admin"
    assert "exp" in decoded
