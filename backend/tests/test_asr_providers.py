"""Unit tests for ASR provider helpers."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

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


def test_health_detailed_reports_asr_openai_when_whisper_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.setenv("ASR_PROVIDER", "whisper")
    monkeypatch.setenv("ASR_OPENAI_BASE_URL", "http://whisper-asr:9000")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=mock_resp)):
        tc = TestClient(app)
        response = tc.get("/api/v1/health/detailed")

    assert response.status_code == 200
    services = response.json()["services"]
    assert "asr_openai" in services
    assert services["asr_openai"]["status"] == "ok"


def test_openai_audio_config_falls_back_over_an_empty_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An override set to the empty string is treated as unset, not as a value.

    ``_env_int``/``_env_float`` in the same module already work this way; the string
    settings used to keep an empty ``MEDASR_*`` in preference to the literal default,
    which produced a base URL of ``""`` and a request to a relative path.
    """
    from app.asr_providers import _openai_audio_config

    monkeypatch.setenv("ASR_OPENAI_BASE_URL", "")
    monkeypatch.setenv("MEDASR_BASE_URL", "")
    monkeypatch.setenv("ASR_OPENAI_TRANSCRIBE_PATH", "")
    monkeypatch.setenv("MEDASR_TRANSCRIBE_PATH", "")
    monkeypatch.setenv("ASR_OPENAI_MODEL", "")
    monkeypatch.setenv("MEDASR_MODEL", "")

    base_url, path, model_name, _timeout, _api_key = _openai_audio_config("openai_audio")

    assert base_url == "http://medasr:8001"
    assert path == "/v1/audio/transcriptions"
    assert model_name == "google/medasr"


def test_openai_audio_config_prefers_the_asr_openai_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.asr_providers import _openai_audio_config

    monkeypatch.setenv("ASR_OPENAI_BASE_URL", "http://whisper-asr:9000/")
    monkeypatch.setenv("MEDASR_BASE_URL", "http://medasr:8001")
    monkeypatch.setenv("ASR_OPENAI_MODEL", "whisper-1")
    monkeypatch.setenv("MEDASR_MODEL", "google/medasr")
    monkeypatch.delenv("ASR_OPENAI_TRANSCRIBE_PATH", raising=False)
    monkeypatch.setenv("MEDASR_TRANSCRIBE_PATH", "/inference")

    base_url, path, model_name, _timeout, _api_key = _openai_audio_config("openai_audio")

    assert base_url == "http://whisper-asr:9000"
    assert path == "/inference"
    assert model_name == "whisper-1"
