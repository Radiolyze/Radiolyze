"""Service-level tests for ExportService and ComparisonService.

The route handlers are thin adapters over these services, so the branches that
are awkward to reach through HTTP are asserted here directly: the STOW-RS
archival that fails without failing the export, the missing-renderer path that
becomes a 501, and the actor-attribution fallback chain the audit trail depends
on.
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

import pytest

from app.models import AuditEvent, Report
from app.schemas import ReportComparisonCreateRequest
from app.services import ComparisonService, ExportService
from app.services.exceptions import (
    FeatureUnavailableError,
    NotFoundError,
    ValidationError,
)
from app.utils.time import utc_now

ORTHANC_URL = "http://orthanc:8042/instances/abc-123"


def _export_events(db) -> list[AuditEvent]:
    return db.query(AuditEvent).filter(AuditEvent.event_type == "report_exported").all()


def _report(db, report_id: str) -> Report:
    report = db.get(Report, report_id)
    assert report is not None
    return report


# ---------------------------------------------------------------------------
# ExportService — structured reports
# ---------------------------------------------------------------------------


def test_export_sr_json_returns_the_artifact_and_records_it(db, sample_report):
    artifact = ExportService(db).export_sr(sample_report["id"], "json")

    assert artifact.filename == f"report-{sample_report['id']}-sr.json"
    assert artifact.content

    (event,) = _export_events(db)
    assert event.metadata_json["format"] == "json"
    assert event.metadata_json["file_name"] == artifact.filename
    # A JSON export is never archived, so there is no PACS URL to record.
    assert event.metadata_json["orthanc_url"] is None


def test_export_sr_normalizes_the_requested_format(db, sample_report):
    artifact = ExportService(db).export_sr(sample_report["id"], "JSON")

    assert artifact.filename.endswith(".json")


def test_export_sr_rejects_an_unknown_format_without_recording_anything(db, sample_report):
    with pytest.raises(ValidationError):
        ExportService(db).export_sr(sample_report["id"], "xml")

    assert _export_events(db) == []


def test_export_sr_rejects_an_unknown_report(db):
    with pytest.raises(NotFoundError):
        ExportService(db).export_sr("no-such-report", "json")


def test_export_sr_missing_report_is_checked_before_the_format(db):
    """A request that is wrong twice over is reported as a missing report."""
    with pytest.raises(NotFoundError):
        ExportService(db).export_sr("no-such-report", "xml")


def test_export_sr_dicom_archives_to_the_pacs(db, sample_report):
    with patch("app.services.export_service.store_sr", return_value=ORTHANC_URL) as store:
        artifact = ExportService(db).export_sr(sample_report["id"], "dicom")

    assert artifact.filename.endswith(".dcm")
    assert store.call_count == 1

    (event,) = _export_events(db)
    assert event.metadata_json["orthanc_url"] == ORTHANC_URL
    assert _report(db, sample_report["id"]).dicom_sr_orthanc_url == ORTHANC_URL


def test_export_sr_survives_a_failed_archival(db, sample_report):
    """An unreachable PACS must not cost the caller a rendered SR.

    The bytes are already produced and the radiologist asked for them; the
    archival is a side effect. The audit event still records that the export
    happened, with no URL to show for it.
    """
    with patch(
        "app.services.export_service.store_sr",
        side_effect=RuntimeError("Orthanc unreachable"),
    ):
        artifact = ExportService(db).export_sr(sample_report["id"], "dicom")

    assert artifact.content

    (event,) = _export_events(db)
    assert event.metadata_json["format"] == "dicom"
    assert event.metadata_json["orthanc_url"] is None
    assert _report(db, sample_report["id"]).dicom_sr_orthanc_url is None


# ---------------------------------------------------------------------------
# ExportService — PDF
# ---------------------------------------------------------------------------


def test_export_pdf_returns_the_document_and_records_it(db, sample_report):
    artifact = ExportService(db).export_pdf(sample_report["id"])

    assert artifact.media_type == "application/pdf"
    assert artifact.content.startswith(b"%PDF")

    (event,) = _export_events(db)
    assert event.metadata_json["format"] == "pdf"
    assert event.metadata_json["file_name"] == artifact.filename


def test_export_pdf_without_a_renderer_records_nothing(db, sample_report):
    """A build without reportlab lacks the capability rather than failing at it."""
    with patch(
        "app.services.export_service.build_pdf_export",
        side_effect=RuntimeError("reportlab is required for PDF export."),
    ):
        with pytest.raises(FeatureUnavailableError):
            ExportService(db).export_pdf(sample_report["id"])

    assert _export_events(db) == []


def test_export_pdf_rejects_an_unknown_report(db):
    with pytest.raises(NotFoundError):
        ExportService(db).export_pdf("no-such-report")


# ---------------------------------------------------------------------------
# ExportService — audit attribution
# ---------------------------------------------------------------------------


def test_authenticated_caller_outranks_the_actor_id_parameter(db, sample_report):
    """``actor_id`` is client-controlled, so a real session always wins."""
    report = _report(db, sample_report["id"])
    report.approved_by = "radio-approver"

    resolved = ExportService.resolve_actor(
        report, current_user_id="radio-session", actor_id="radio-claimed"
    )

    assert resolved == "radio-session"


def test_actor_id_is_used_when_there_is_no_session(db, sample_report):
    report = _report(db, sample_report["id"])
    report.approved_by = "radio-approver"

    resolved = ExportService.resolve_actor(report, current_user_id=None, actor_id="radio-claimed")

    assert resolved == "radio-claimed"


def test_the_approver_is_the_last_resort(db, sample_report):
    report = _report(db, sample_report["id"])
    report.approved_by = "radio-approver"

    resolved = ExportService.resolve_actor(report, current_user_id=None, actor_id=None)

    assert resolved == "radio-approver"


def test_an_unattributable_export_is_still_recorded(db, sample_report):
    """No session, no parameter and an unapproved report leaves no actor."""
    report = _report(db, sample_report["id"])
    assert report.approved_by is None

    ExportService(db).export_sr(sample_report["id"], "json")

    (event,) = _export_events(db)
    assert event.actor_id is None


def test_the_resolved_actor_reaches_the_audit_trail(db, sample_report):
    ExportService(db).export_sr(
        sample_report["id"], "json", current_user_id="radio-session", actor_id="radio-claimed"
    )

    (event,) = _export_events(db)
    assert event.actor_id == "radio-session"


# ---------------------------------------------------------------------------
# ComparisonService
# ---------------------------------------------------------------------------


def _create(db, report_id: str, prior_study_uid: str) -> None:
    ComparisonService(db).create(
        report_id,
        ReportComparisonCreateRequest(priorStudyUid=prior_study_uid),
    )


def test_create_pairs_a_prior_study_with_the_report(db, sample_report):
    comparison = ComparisonService(db).create(
        sample_report["id"],
        ReportComparisonCreateRequest(
            priorStudyUid="1.2.3.prior",
            priorSeriesUid="1.2.3.prior.series",
            timeDeltaDays=180,
        ),
    )

    assert comparison.id
    assert comparison.current_report_id == sample_report["id"]
    assert comparison.time_delta_days == 180

    serialized = ComparisonService.serialize(comparison)
    assert serialized.prior_study_uid == "1.2.3.prior"
    assert serialized.prior_series_uid == "1.2.3.prior.series"
    assert serialized.created_at == comparison.created_at


def test_create_rejects_an_unknown_report(db):
    with pytest.raises(NotFoundError):
        _create(db, "no-such-report", "1.2.3.prior")


def test_list_returns_newest_first(db, sample_report):
    older = ComparisonService(db).create(
        sample_report["id"], ReportComparisonCreateRequest(priorStudyUid="1.2.3.prior-a")
    )
    newer = ComparisonService(db).create(
        sample_report["id"], ReportComparisonCreateRequest(priorStudyUid="1.2.3.prior-b")
    )
    # Stamped rather than relying on two calls landing on different clock
    # readings, which is what the ordering would otherwise turn on.
    older.created_at = utc_now() - timedelta(days=1)
    newer.created_at = utc_now()
    db.commit()

    listed = ComparisonService(db).list_for_report(sample_report["id"])

    assert [c.prior_study_uid for c in listed] == ["1.2.3.prior-b", "1.2.3.prior-a"]


def test_list_is_scoped_to_its_report(db, sample_report, client):
    other = client.post(
        "/api/v1/reports/create",
        json={"study_id": "study-other", "patient_id": "patient-other"},
    ).json()
    _create(db, sample_report["id"], "1.2.3.prior-a")
    _create(db, other["id"], "1.2.3.prior-b")

    listed = ComparisonService(db).list_for_report(sample_report["id"])

    assert [c.prior_study_uid for c in listed] == ["1.2.3.prior-a"]


def test_list_does_not_require_the_report_to_exist(db):
    """An unknown id simply has no comparisons — an empty list already says so."""
    assert ComparisonService(db).list_for_report("no-such-report") == []
