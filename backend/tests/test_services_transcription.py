"""Service-level tests for TranscriptionService.

The route handler is a thin adapter over this service, so the branches that are
awkward to reach through HTTP are asserted here directly: the payload bounds,
the provider failure that becomes a 502, and the audit provenance recorded
alongside a transcript — including the case where the named report does not
exist, which the handler's nesting previously left implicit.

The service's async method is driven with ``asyncio.run`` rather than an async
test plugin, which the backend does not use.
"""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from app.models import AuditEvent, Report
from app.services import TranscriptionService
from app.services.exceptions import (
    PayloadTooLargeError,
    UpstreamError,
    ValidationError,
)
from app.utils.hashing import compute_bytes_hash

AUDIO = b"fake-audio-bytes"
ASR_RESULT = ("Kein Pneumothorax.", 0.93, "mock-medasr-0.1", {"provider": "mock"})


def _patch_provider(result=ASR_RESULT, side_effect=None):
    async def _fake(**_kwargs):
        if side_effect is not None:
            raise side_effect
        return result

    return patch("app.services.transcription_service.transcribe_audio", new=_fake)


def _transcribe(db, **kwargs):
    kwargs.setdefault("content", AUDIO)
    kwargs.setdefault("filename", "dictation.wav")
    return asyncio.run(TranscriptionService(db).transcribe(**kwargs))


def _asr_events(db) -> list[AuditEvent]:
    return db.query(AuditEvent).filter(AuditEvent.event_type == "asr_transcription").all()


# ---------------------------------------------------------------------------
# Payload bounds
# ---------------------------------------------------------------------------


def test_an_empty_upload_is_rejected(db):
    with _patch_provider():
        with pytest.raises(ValidationError):
            _transcribe(db, content=b"")


def test_an_oversize_upload_is_rejected(db, monkeypatch):
    monkeypatch.setenv("ASR_MAX_FILE_SIZE", "8")

    with _patch_provider():
        with pytest.raises(PayloadTooLargeError) as excinfo:
            _transcribe(db, content=b"x" * 9)

    # The limit is reported in whole megabytes, which rounds down to 0 here.
    assert "too large" in str(excinfo.value)


def test_an_upload_at_the_limit_is_accepted(db, monkeypatch):
    monkeypatch.setenv("ASR_MAX_FILE_SIZE", "8")

    with _patch_provider():
        result = _transcribe(db, content=b"x" * 8)

    assert result.text == ASR_RESULT[0]


def test_the_limit_is_read_from_the_environment(monkeypatch):
    monkeypatch.setenv("ASR_MAX_FILE_SIZE", "1234")
    assert TranscriptionService.max_audio_bytes() == 1234

    monkeypatch.delenv("ASR_MAX_FILE_SIZE", raising=False)
    assert TranscriptionService.max_audio_bytes() == 25 * 1024 * 1024


def test_the_bounds_are_checked_before_the_provider_is_called(db):
    """An unusable payload must not cost a model call."""
    calls: list[object] = []

    async def _fake(**kwargs):
        calls.append(kwargs)
        return ASR_RESULT

    with patch("app.services.transcription_service.transcribe_audio", new=_fake):
        with pytest.raises(ValidationError):
            _transcribe(db, content=b"")

    assert calls == []


# ---------------------------------------------------------------------------
# Provider failures
# ---------------------------------------------------------------------------


def test_an_unreachable_provider_surfaces_as_an_upstream_failure(db):
    with _patch_provider(side_effect=RuntimeError("ASR backend unreachable")):
        with pytest.raises(UpstreamError) as excinfo:
            _transcribe(db)

    assert "unreachable" in str(excinfo.value)


def test_a_failed_transcription_records_nothing(db, sample_report):
    with _patch_provider(side_effect=RuntimeError("ASR backend unreachable")):
        with pytest.raises(UpstreamError):
            _transcribe(db, report_id=sample_report["id"])

    assert _asr_events(db) == []


# ---------------------------------------------------------------------------
# Transcribe + record
# ---------------------------------------------------------------------------


def test_a_transcript_without_a_report_touches_nothing(db):
    with _patch_provider():
        result = _transcribe(db)

    assert result.text == ASR_RESULT[0]
    assert result.confidence == ASR_RESULT[1]
    assert result.recorded is False
    assert result.qa_status is None
    assert _asr_events(db) == []


def test_a_transcript_for_a_report_is_recorded_with_its_provenance(db, sample_report):
    with _patch_provider():
        result = _transcribe(db, report_id=sample_report["id"], language="de-DE")

    assert result.recorded is True
    assert result.qa_status == "pending"

    (event,) = _asr_events(db)
    assert event.report_id == sample_report["id"]
    assert event.study_id == sample_report["study_id"]
    assert event.actor_id is None
    assert event.metadata_json["confidence"] == ASR_RESULT[1]
    assert event.metadata_json["model_version"] == ASR_RESULT[2]
    assert event.metadata_json["transcript_length"] == len(ASR_RESULT[0])
    assert event.metadata_json["output_summary"] == f"transcript_length={len(ASR_RESULT[0])}"
    assert event.metadata_json["asr_language_requested"] == "de-DE"


def test_the_audio_hash_is_what_ties_a_transcript_to_its_recording(db, sample_report):
    """The audio is never stored, so its digest is the only link back to it."""
    with _patch_provider():
        _transcribe(db, content=AUDIO, report_id=sample_report["id"])

    (event,) = _asr_events(db)
    assert event.metadata_json["input_hash"] == compute_bytes_hash(AUDIO)


def test_provider_metadata_wins_over_the_defaults(db, sample_report):
    """A provider reporting a more precise value must not be overwritten."""
    with _patch_provider(
        result=("Text", 0.5, "generic", {"model_version": "medasr-2.1", "asr_provider": "medasr"})
    ):
        _transcribe(db, report_id=sample_report["id"])

    (event,) = _asr_events(db)
    assert event.metadata_json["model_version"] == "medasr-2.1"
    assert event.metadata_json["asr_provider"] == "medasr"


def test_a_recorded_transcript_touches_the_report(db, sample_report):
    report = db.get(Report, sample_report["id"])
    before = report.updated_at

    with _patch_provider():
        result = _transcribe(db, report_id=sample_report["id"])

    db.refresh(report)
    assert report.updated_at == result.timestamp
    assert report.updated_at != before


def test_a_transcript_for_an_unknown_report_is_still_recorded(db):
    """The transcription happened; the event says so, with no study to name.

    The caller may be dictating against a report that has not been saved yet.
    Dropping the event would lose the only record that audio was processed.
    """
    with _patch_provider():
        result = _transcribe(db, report_id="no-such-report")

    assert result.recorded is True
    # No row means no QA state — distinct from a report whose QA is pending.
    assert result.qa_status is None

    (event,) = _asr_events(db)
    assert event.report_id == "no-such-report"
    assert event.study_id is None


# ---------------------------------------------------------------------------
# Route adapter
# ---------------------------------------------------------------------------


def test_the_route_reports_an_empty_upload_as_a_bad_request(client):
    response = client.post(
        "/api/v1/reports/asr-transcript",
        files={"file": ("empty.wav", b"", "audio/wav")},
    )
    assert response.status_code == 400


def test_the_route_reports_an_oversize_upload_as_too_large(client, monkeypatch):
    monkeypatch.setenv("ASR_MAX_FILE_SIZE", "8")

    response = client.post(
        "/api/v1/reports/asr-transcript",
        files={"file": ("big.wav", b"x" * 64, "audio/wav")},
    )
    assert response.status_code == 413


def test_the_route_broadcasts_a_pending_qa_status_for_an_unknown_report(client):
    """A transcript naming no known report still broadcasts, with a QA default."""
    broadcasts: list[tuple[str, dict]] = []

    async def _capture(report_id, payload):
        broadcasts.append((report_id, payload))

    with patch("app.api.reports.broadcast_status", new=_capture):
        response = client.post(
            "/api/v1/reports/asr-transcript",
            files={"file": ("dictation.wav", AUDIO, "audio/wav")},
            data={"report_id": "no-such-report"},
        )

    assert response.status_code == 200
    (report_id, payload) = broadcasts[0]
    assert report_id == "no-such-report"
    assert payload["qaStatus"] == "pending"
    assert payload["asrStatus"] == "processing"


def test_the_route_does_not_broadcast_without_a_report(client):
    broadcasts: list[tuple[str, dict]] = []

    async def _capture(report_id, payload):
        broadcasts.append((report_id, payload))

    with patch("app.api.reports.broadcast_status", new=_capture):
        response = client.post(
            "/api/v1/reports/asr-transcript",
            files={"file": ("dictation.wav", AUDIO, "audio/wav")},
        )

    assert response.status_code == 200
    assert broadcasts == []
