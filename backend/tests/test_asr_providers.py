"""Unit tests for ASR provider helpers."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.asr_providers import asr_inference_enabled, normalize_asr_language


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, None),
        ("", None),
        ("  ", None),
        ("de-DE", "de"),
        ("en-US", "en"),
        ("EN", "en"),
        ("fr", "fr"),
        ("invalid!", None),
    ],
)
def test_normalize_asr_language(raw: str | None, expected: str | None) -> None:
    assert normalize_asr_language(raw) == expected


def test_asr_inference_enabled_prefers_asr_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ASR_ENABLED", raising=False)
    monkeypatch.setenv("MEDASR_ENABLED", "false")
    assert asr_inference_enabled() is False

    monkeypatch.setenv("ASR_ENABLED", "true")
    monkeypatch.setenv("MEDASR_ENABLED", "false")
    assert asr_inference_enabled() is True

    monkeypatch.setenv("ASR_ENABLED", "false")
    monkeypatch.setenv("MEDASR_ENABLED", "true")
    assert asr_inference_enabled() is False

    monkeypatch.delenv("ASR_ENABLED", raising=False)
    monkeypatch.setenv("MEDASR_ENABLED", "true")
    assert asr_inference_enabled() is True


def test_health_reports_asr_openai_when_whisper_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.setenv("ASR_PROVIDER", "whisper")
    monkeypatch.setenv("ASR_OPENAI_BASE_URL", "http://whisper-asr:9000")

    with patch("httpx.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_get.return_value = mock_resp
        tc = TestClient(app)
        response = tc.get("/api/v1/health")

    assert response.status_code == 200
    services = response.json()["services"]
    assert "asr_openai" in services
    assert services["asr_openai"]["status"] == "ok"
