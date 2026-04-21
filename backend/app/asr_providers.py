"""ASR (speech-to-text) provider selection and OpenAI-compatible transcription clients."""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Literal

import httpx

from .mock_logic import generate_asr_transcript

logger = logging.getLogger(__name__)

ASRMetadata = dict[str, Any]


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _compact_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in metadata.items() if value is not None}


def asr_inference_enabled() -> bool:
    """True when ASR should call a real HTTP backend (not mock).

    If ``ASR_ENABLED`` is set in the environment, it wins; otherwise ``MEDASR_ENABLED``
    is used for backward compatibility.
    """
    if os.getenv("ASR_ENABLED") is not None:
        return _env_flag("ASR_ENABLED", False)
    return _env_flag("MEDASR_ENABLED", False)


def normalize_asr_language(language: str | None) -> str | None:
    """Map BCP-47 tags (e.g. de-DE) to ISO-639-1 for OpenAI-style ASR APIs."""
    if not language:
        return None
    raw = language.strip()
    if not raw:
        return None
    primary = raw.split("-", 1)[0].strip().lower()
    if len(primary) == 2 and primary.isalpha():
        return primary
    return None


def _openai_audio_config(
    mode: Literal["medasr", "openai_audio"],
) -> tuple[str, str, str, float, str | None]:
    if mode == "medasr":
        base_url = os.getenv("MEDASR_BASE_URL", "http://medasr:8001").rstrip("/")
        path = os.getenv("MEDASR_TRANSCRIBE_PATH", "/v1/audio/transcriptions")
        model_name = os.getenv("MEDASR_MODEL", "google/medasr")
        timeout = float(_env_int("MEDASR_REQUEST_TIMEOUT", 60))
        api_key = os.getenv("MEDASR_API_KEY")
        return base_url, path, model_name, timeout, api_key

    base_url = (os.getenv("ASR_OPENAI_BASE_URL") or os.getenv("MEDASR_BASE_URL", "http://medasr:8001")).rstrip(
        "/"
    )
    path = os.getenv("ASR_OPENAI_TRANSCRIBE_PATH") or os.getenv(
        "MEDASR_TRANSCRIBE_PATH", "/v1/audio/transcriptions"
    )
    model_name = os.getenv("ASR_OPENAI_MODEL") or os.getenv("MEDASR_MODEL", "google/medasr")
    timeout = float(
        _env_int(
            "ASR_OPENAI_REQUEST_TIMEOUT",
            _env_int("MEDASR_REQUEST_TIMEOUT", 60),
        )
    )
    api_key = os.getenv("ASR_OPENAI_API_KEY") or os.getenv("MEDASR_API_KEY")
    return base_url, path, model_name, timeout, api_key


async def _post_openai_compatible_transcription(
    *,
    url: str,
    model_name: str,
    timeout: float,
    api_key: str | None,
    content: bytes,
    filename: str,
    content_type: str | None,
    language: str | None,
) -> tuple[str, float, str, ASRMetadata]:
    headers: dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    files = {"file": (filename, content, content_type or "application/octet-stream")}
    data: dict[str, str] = {"model": model_name}
    if language and _env_flag("ASR_SEND_LANGUAGE", True):
        data["language"] = language

    start_time = time.monotonic()
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, data=data, files=files, headers=headers)
        response.raise_for_status()
        try:
            payload = response.json()
        except ValueError:
            payload = {"text": response.text}
    text = payload.get("text") or payload.get("transcript")
    if not text and isinstance(payload.get("segments"), list):
        text = " ".join(segment.get("text", "") for segment in payload["segments"]).strip()
    if not text:
        raise RuntimeError("ASR service returned no transcript")
    confidence = payload.get("confidence")
    if confidence is None:
        confidence = _env_float("MEDASR_DEFAULT_CONFIDENCE", 0.0)
    latency_ms = int((time.monotonic() - start_time) * 1000)
    meta = _compact_metadata(
        {
            "provider": "openai_audio",
            "latency_ms": latency_ms,
            "language_requested": language,
        }
    )
    return text, float(confidence), model_name, meta


def _asr_provider_mode() -> Literal["medasr", "openai_audio"]:
    raw = os.getenv("ASR_PROVIDER", "medasr").strip().lower()
    if raw in {"openai", "openai_audio", "whisper", "whisper_http"}:
        return "openai_audio"
    return "medasr"


async def transcribe_audio(
    *,
    content: bytes,
    filename: str,
    content_type: str | None,
    language: str | None = None,
) -> tuple[str, float, str, ASRMetadata]:
    """Transcribe audio using configured ASR provider (mock, MedASR, or generic OpenAI-audio API)."""
    if not asr_inference_enabled():
        text, confidence = generate_asr_transcript()
        return text, confidence, "mock-medasr-0.1", {"provider": "mock"}

    mode = _asr_provider_mode()
    base_url, path, model_name, timeout, api_key = _openai_audio_config(mode)
    url = f"{base_url}{path}"
    lang = normalize_asr_language(language)

    try:
        text, confidence, used_model, metadata = await _post_openai_compatible_transcription(
            url=url,
            model_name=model_name,
            timeout=timeout,
            api_key=api_key,
            content=content,
            filename=filename,
            content_type=content_type,
            language=lang,
        )
        meta = {**metadata, "asr_provider": mode}
        if mode == "medasr":
            meta["provider"] = "medasr"
        return text, confidence, used_model, meta
    except Exception as exc:
        logger.warning("ASR transcription failed (%s): %s", mode, exc)
        if _env_flag("MEDASR_FALLBACK_TO_MOCK", True):
            text, confidence = generate_asr_transcript()
            return text, confidence, "mock-medasr-0.1", {
                "provider": "mock",
                "error": str(exc),
                "asr_provider": mode,
            }
        raise RuntimeError("ASR transcription failed") from exc
