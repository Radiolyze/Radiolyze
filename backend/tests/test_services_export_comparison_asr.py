"""Service-level tests for ExportService, ComparisonService and ASRService.

The route handlers are thin adapters over these services, so the branches that
are awkward to reach through HTTP are asserted here directly: the non-fatal
STOW-RS archival failure, the actor-resolution precedence recorded in the audit
trail, the upload-size gate, and the transcription that outlives its report.

The services' async methods are driven with ``asyncio.run`` rather than an
async test plugin, which the backend does not use.
"""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from app.models import AuditEvent, Report, ReportComparison
from app.schemas import ReportComparisonCreateRequest
from app.services import ASRService, ComparisonService, ExportService
from app.services.exceptions import (
    NotFoundError,
    UpstreamError,
    ValidationError,
)
from app.services.export_service import UnsupportedExportError

ASR_RESULT = ("Kein Anhalt für Pneumothorax.", 0.88, "mock-medasr-0.1", None)


def _export_events(db) -> list[AuditEvent]:
    return db.query(AuditEvent).filter(AuditEvent.event_type == "report_exported").all()


def _transcribe(db, content: bytes, *, report_id: str | None = None, language=None):
    return asyncio.run(
        ASRService(db).transcribe(
            content,
            filename="dictation.wav",
            content_type="audio/wav",
            language=language,
            report_id=report_id,
        )
    )


def _patch_asr(result=ASR_RESULT, side_effect=None):
    async def _fake(**_kwargs):
        if side_effect is not None:
            raise side_effect
        return result

    return patch("app.services.asr_service.transcribe_audio", side_effect=_fake)


# ---------------------------------------------------------------------------
# ExportService — actor resolution
# ---------------------------------------------------------------------------


def test_authenticated_caller_outranks_the_client_supplied_actor_id():
    report = Report(id="r1", study_id="s1", approved_by="approver")
    assert (
        ExportService.resolve_actor(report, current_user_id="real-user", actor_id="spoofed")
        == "real-user"
    )


def test_actor_id_is_used_only_without_an_authenticated_caller():
    report = Report(id="r1", study_id="s1", approved_by="approver")
    assert ExportService.resolve_actor(report, current_user_id=None, actor_id="dev") == "dev"


def test_actor_falls_back_to_the_approver_when_nothing_is_supplied():
    report = Report(id="r1", study_id="s1", approved_by="approver")
    assert ExportService.resolve_actor(report, current_user_id=None, actor_id=None) == "approver"


# ---------------------------------------------------------------------------
# ExportService — structured report
# ---------------------------------------------------------------------------


def test_export_sr_records_the_export_with_the_authenticated_actor(db, sample_report):
    result = ExportService(db).export_structured_report(
        sample_report["id"],
        export_format="json",
        current_user_id="user-7",
        actor_id="ignored",
    )

    assert result.media_type
    assert result.filename

    events = _export_events(db)
    assert len(events) == 1
    assert events[0].actor_id == "user-7"
    assert events[0].metadata_json["format"] == "json"
    # No archival is attempted for JSON, so the field is present but empty.
    assert events[0].metadata_json["orthanc_url"] is None


def test_export_sr_uppercase_format_is_accepted(db, sample_report):
    result = ExportService(db).export_structured_report(
        sample_report["id"],
        export_format="JSON",
        current_user_id=None,
        actor_id=None,
    )
    assert result.filename
    assert _export_events(db)[0].metadata_json["format"] == "json"


def test_export_sr_rejects_an_unknown_format(db, sample_report):
    with pytest.raises(ValidationError) as exc:
        ExportService(db).export_structured_report(
            sample_report["id"],
            export_format="pdf",
            current_user_id=None,
            actor_id=None,
        )
    assert exc.value.status_code == 400
    # Nothing was exported, so nothing is recorded.
    assert _export_events(db) == []


def test_export_sr_on_a_missing_report_is_not_found(db):
    with pytest.raises(NotFoundError):
        ExportService(db).export_structured_report(
            "nope",
            export_format="json",
            current_user_id=None,
            actor_id=None,
        )


def test_dicom_export_records_the_orthanc_url_it_archived_to(db, sample_report):
    with patch("app.services.export_service.store_sr", return_value="http://orthanc/sr/1"):
        ExportService(db).export_structured_report(
            sample_report["id"],
            export_format="dicom",
            current_user_id="user-7",
            actor_id=None,
        )

    assert _export_events(db)[0].metadata_json["orthanc_url"] == "http://orthanc/sr/1"
    assert db.get(Report, sample_report["id"]).dicom_sr_orthanc_url == "http://orthanc/sr/1"


def test_a_failed_archival_still_returns_the_export(db, sample_report):
    # The radiologist asked for a file. An unreachable PACS is no reason to
    # withhold one that was built successfully — the export succeeds and the
    # null orthanc_url is what marks it as unarchived after the fact.
    with patch(
        "app.services.export_service.store_sr",
        side_effect=RuntimeError("orthanc unreachable"),
    ):
        result = ExportService(db).export_structured_report(
            sample_report["id"],
            export_format="dicom",
            current_user_id="user-7",
            actor_id=None,
        )

    assert result.content
    events = _export_events(db)
    assert len(events) == 1
    assert events[0].metadata_json["orthanc_url"] is None
    assert db.get(Report, sample_report["id"]).dicom_sr_orthanc_url is None


# ---------------------------------------------------------------------------
# ExportService — PDF
# ---------------------------------------------------------------------------


def test_export_pdf_records_the_export(db, sample_report):
    with patch(
        "app.pdf_export.build_pdf_export",
        return_value=(b"%PDF-1.4 fake", "report.pdf"),
    ):
        result = ExportService(db).export_pdf(
            sample_report["id"], current_user_id="user-7", actor_id=None
        )

    assert result.media_type == "application/pdf"
    assert result.filename == "report.pdf"
    events = _export_events(db)
    assert len(events) == 1
    # `source` is folded in by add_audit_event, so this is a subset check.
    assert events[0].metadata_json["format"] == "pdf"
    assert events[0].metadata_json["file_name"] == "report.pdf"
    # Unlike an SR export, a PDF is never archived, so no orthanc_url is recorded.
    assert "orthanc_url" not in events[0].metadata_json


def test_a_missing_pdf_toolchain_is_unsupported_not_a_bad_request(db, sample_report):
    # The request is well-formed; this deployment simply cannot render a PDF.
    with patch(
        "app.pdf_export.build_pdf_export",
        side_effect=RuntimeError("reportlab not installed"),
    ):
        with pytest.raises(UnsupportedExportError) as exc:
            ExportService(db).export_pdf(sample_report["id"], current_user_id=None, actor_id=None)

    assert exc.value.status_code == 501
    assert _export_events(db) == []


def test_export_pdf_on_a_missing_report_is_not_found(db):
    with pytest.raises(NotFoundError):
        ExportService(db).export_pdf("nope", current_user_id=None, actor_id=None)


# ---------------------------------------------------------------------------
# ComparisonService
# ---------------------------------------------------------------------------


def test_create_comparison_stores_the_prior_study(db, sample_report):
    comparison = ComparisonService(db).create(
        sample_report["id"],
        ReportComparisonCreateRequest(
            prior_study_uid="1.2.3", prior_series_uid="1.2.3.4", time_delta_days=90
        ),
    )

    assert comparison.id
    assert comparison.current_report_id == sample_report["id"]
    assert comparison.prior_study_uid == "1.2.3"
    assert comparison.time_delta_days == 90


def test_a_comparison_cannot_be_orphaned_from_its_report(db):
    with pytest.raises(NotFoundError):
        ComparisonService(db).create("nope", ReportComparisonCreateRequest(prior_study_uid="1.2.3"))
    assert db.query(ReportComparison).count() == 0


def test_comparisons_are_listed_newest_first(db, sample_report):
    service = ComparisonService(db)
    for uid in ("oldest", "middle", "newest"):
        service.create(sample_report["id"], ReportComparisonCreateRequest(prior_study_uid=uid))

    listed = service.list_for_report(sample_report["id"])
    assert [c.prior_study_uid for c in listed] == ["newest", "middle", "oldest"]


def test_listing_an_unknown_report_is_empty_rather_than_not_found(db):
    # Long-standing behaviour of this endpoint: no report, no comparisons, no
    # error — the caller cannot tell an unknown report from one with none.
    assert ComparisonService(db).list_for_report("nope") == []


def test_comparisons_are_scoped_to_their_own_report(db, sample_report, client):
    other = client.post(
        "/api/v1/reports/create",
        json={"study_id": "study-002", "patient_id": "patient-002"},
    ).json()

    service = ComparisonService(db)
    service.create(sample_report["id"], ReportComparisonCreateRequest(prior_study_uid="mine"))
    service.create(other["id"], ReportComparisonCreateRequest(prior_study_uid="theirs"))

    assert [c.prior_study_uid for c in service.list_for_report(sample_report["id"])] == ["mine"]


# ---------------------------------------------------------------------------
# ASRService
# ---------------------------------------------------------------------------


def test_empty_audio_is_rejected(db):
    with pytest.raises(ValidationError) as exc:
        _transcribe(db, b"")
    assert exc.value.status_code == 400


def test_oversized_audio_is_rejected_as_too_large(db, monkeypatch):
    monkeypatch.setenv("ASR_MAX_FILE_SIZE", "10")
    with pytest.raises(ValidationError) as exc:
        _transcribe(db, b"x" * 11)
    # 413, not 400 — the request is well-formed, just too big.
    assert exc.value.status_code == 413


def test_audio_exactly_at_the_limit_is_accepted(db, monkeypatch):
    monkeypatch.setenv("ASR_MAX_FILE_SIZE", "10")
    with _patch_asr():
        result = _transcribe(db, b"x" * 10)
    assert result.text == ASR_RESULT[0]


def test_the_size_limit_is_read_per_call(db, monkeypatch):
    # Deployments change ASR_MAX_FILE_SIZE without restarting; a value captured
    # at import time would ignore them.
    monkeypatch.setenv("ASR_MAX_FILE_SIZE", "5")
    with pytest.raises(ValidationError):
        _transcribe(db, b"x" * 6)

    monkeypatch.setenv("ASR_MAX_FILE_SIZE", "100")
    with _patch_asr():
        assert _transcribe(db, b"x" * 6).text


def test_an_unreachable_asr_backend_is_an_upstream_failure(db):
    with _patch_asr(side_effect=RuntimeError("medasr down")):
        with pytest.raises(UpstreamError):
            _transcribe(db, b"audio")


def test_transcribing_without_a_report_id_touches_nothing(db):
    with _patch_asr():
        result = _transcribe(db, b"audio")

    assert result.text == ASR_RESULT[0]
    assert result.persisted is False
    assert result.qa_status is None
    assert db.query(AuditEvent).filter(AuditEvent.event_type == "asr_transcription").count() == 0


def test_transcribing_against_a_report_records_provenance(db, sample_report):
    report_id = sample_report["id"]
    before = db.get(Report, report_id).updated_at

    with _patch_asr():
        result = _transcribe(db, b"audio", report_id=report_id, language="de-DE")

    assert result.persisted is True
    assert result.qa_status == "pending"

    events = db.query(AuditEvent).filter(AuditEvent.event_type == "asr_transcription").all()
    assert len(events) == 1
    metadata = events[0].metadata_json
    assert metadata["confidence"] == ASR_RESULT[1]
    assert metadata["model_version"] == ASR_RESULT[2]
    assert metadata["transcript_length"] == len(ASR_RESULT[0])
    assert metadata["asr_language_requested"] == "de-DE"
    assert metadata["input_hash"]
    assert events[0].study_id == sample_report["study_id"]

    db.refresh(report := db.get(Report, report_id))
    assert report.updated_at >= before


def test_provider_metadata_wins_over_the_defaults(db, sample_report):
    with _patch_asr(result=("text", 0.5, "provider-model", {"model_version": "precise-1.2"})):
        _transcribe(db, b"audio", report_id=sample_report["id"])

    events = db.query(AuditEvent).filter(AuditEvent.event_type == "asr_transcription").all()
    assert events[0].metadata_json["model_version"] == "precise-1.2"


def test_a_dictation_outlives_a_report_that_is_gone(db):
    # Long-standing behaviour: the transcript is still worth recording, so the
    # audit event is written against the id even with no report behind it.
    with _patch_asr():
        result = _transcribe(db, b"audio", report_id="deleted-report")

    assert result.persisted is True
    # Nothing to read a real status off, so the broadcast default stands in.
    assert result.qa_status == "pending"

    events = db.query(AuditEvent).filter(AuditEvent.event_type == "asr_transcription").all()
    assert len(events) == 1
    assert events[0].report_id == "deleted-report"
    assert events[0].study_id is None
