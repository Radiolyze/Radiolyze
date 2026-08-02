"""Tests for the timezone-aware timestamp columns (#102).

The timestamp columns used to be ``String`` holding ISO-8601 text. Three
things had to survive the move to ``DateTime(timezone=True)``, and each has
tests here: values come back as aware UTC datetimes on every backend, the
audit hash chain still verifies against hashes computed over the old strings,
and the JSON the API emits is unchanged.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta, timezone

from app.api.monitoring import compute_drift_snapshot
from app.audit import add_audit_event, verify_audit_chain
from app.models import AuditEvent, InferenceJob, QACheckResult, Report
from app.utils.hashing import compute_audit_event_hash
from app.utils.time import ensure_utc, format_datetime, parse_datetime, utc_now

# An offset that is neither UTC nor a whole-day shift, so a value written in
# it sorts differently as text than it does as an instant.
BERLIN_SUMMER = timezone(timedelta(hours=2))


# ---------------------------------------------------------------------------
# Storage round-trip
# ---------------------------------------------------------------------------


def test_stored_timestamp_reads_back_as_aware_utc(db):
    written = datetime(2026, 7, 1, 12, 30, 45, 123456, tzinfo=UTC)
    db.add(
        Report(
            id="ts-1",
            study_id="s",
            patient_id="p",
            status="draft",
            findings_text="",
            impression_text="",
            created_at=written,
            updated_at=written,
            qa_status="pending",
            qa_warnings=[],
        )
    )
    db.commit()
    db.expire_all()

    loaded = db.get(Report, "ts-1")
    assert loaded.created_at.tzinfo is not None
    assert loaded.created_at == written
    assert loaded.created_at.utcoffset() == timedelta(0)


def test_non_utc_value_is_normalised_to_utc_on_write(db):
    """A value in another offset is stored as the same instant, rendered in UTC.

    This is what makes ordering trustworthy: two rows written from machines in
    different timezones are comparable, which was not true when the column
    held whatever string each writer produced.
    """
    berlin = datetime(2026, 7, 1, 14, 30, 45, tzinfo=BERLIN_SUMMER)
    db.add(
        Report(
            id="ts-2",
            study_id="s",
            patient_id="p",
            status="draft",
            findings_text="",
            impression_text="",
            created_at=berlin,
            updated_at=berlin,
            qa_status="pending",
            qa_warnings=[],
        )
    )
    db.commit()
    db.expire_all()

    loaded = db.get(Report, "ts-2")
    assert loaded.created_at == berlin
    assert loaded.created_at.isoformat() == "2026-07-01T12:30:45+00:00"


def test_ordering_is_chronological_not_lexicographic(db):
    """The bug this migration closes.

    ``13:00+02:00`` is 11:00 UTC, so it is *earlier* than ``12:00+00:00`` — but
    as text it sorts later. With real timestamps the database gets it right.
    """
    for job_id, value in (
        ("job-utc", datetime(2026, 7, 1, 12, 0, tzinfo=UTC)),
        ("job-berlin", datetime(2026, 7, 1, 13, 0, tzinfo=BERLIN_SUMMER)),
    ):
        db.add(InferenceJob(id=job_id, status="finished", model_version="m", queued_at=value))
    db.commit()

    ordered = [j.id for j in db.query(InferenceJob).order_by(InferenceJob.queued_at.asc()).all()]
    assert ordered == ["job-berlin", "job-utc"]


# ---------------------------------------------------------------------------
# Audit hash chain
# ---------------------------------------------------------------------------


def test_audit_hash_matches_the_pre_migration_string_hash():
    """A datetime hashes to what its ISO string hashed to before the migration.

    This is the invariant the data migration relies on: rows written when the
    column was a ``String`` keep verifying afterwards, because the canonical
    form is the same text either way.
    """
    moment = datetime(2026, 7, 1, 12, 0, 0, 123456, tzinfo=UTC)
    fields = dict(
        seq=1,
        prev_hash=None,
        event_type="report_created",
        actor_id="u1",
        report_id="r1",
        study_id="s1",
        metadata={"source": "test"},
    )
    assert compute_audit_event_hash(timestamp=moment, **fields) == compute_audit_event_hash(
        timestamp=moment.isoformat(), **fields
    )


def test_audit_hash_is_stable_for_zero_microseconds():
    """isoformat() drops the fractional part when microseconds are zero.

    The migration's downgrade has to reproduce that exactly, so pin the
    behaviour the hash depends on.
    """
    moment = datetime(2026, 7, 1, 12, 0, 0, tzinfo=UTC)
    assert moment.isoformat() == "2026-07-01T12:00:00+00:00"
    assert compute_audit_event_hash(
        seq=1,
        prev_hash=None,
        event_type="e",
        actor_id=None,
        report_id=None,
        study_id=None,
        timestamp=moment,
        metadata=None,
    ) == compute_audit_event_hash(
        seq=1,
        prev_hash=None,
        event_type="e",
        actor_id=None,
        report_id=None,
        study_id=None,
        timestamp="2026-07-01T12:00:00+00:00",
        metadata=None,
    )


def test_audit_chain_verifies_after_a_write_read_round_trip(db):
    """Hash written from an in-memory datetime, verified from a reloaded one."""
    for index in range(3):
        add_audit_event(db, event_type=f"event_{index}", actor_id="u1", report_id="r1")
    db.commit()
    db.expire_all()

    assert verify_audit_chain(db) == (True, [])


def test_audit_chain_still_detects_tampering(db):
    add_audit_event(db, event_type="event_0", actor_id="u1")
    add_audit_event(db, event_type="event_1", actor_id="u1")
    db.commit()

    victim = db.query(AuditEvent).filter(AuditEvent.seq == 1).one()
    victim.timestamp = victim.timestamp + timedelta(seconds=1)
    db.commit()
    db.expire_all()

    valid, broken = verify_audit_chain(db)
    assert valid is False
    assert 1 in broken


def test_client_supplied_timestamp_is_parsed(db):
    event = add_audit_event(db, event_type="e", timestamp="2026-07-01T12:00:00+00:00")
    db.commit()
    assert event.timestamp == datetime(2026, 7, 1, 12, 0, tzinfo=UTC)


def test_unparseable_client_timestamp_falls_back_to_now(db):
    """A malformed client timestamp must not 500 the audit endpoint."""
    before = utc_now()
    event = add_audit_event(db, event_type="e", timestamp="not-a-timestamp")
    db.commit()
    assert before <= event.timestamp <= utc_now()


# ---------------------------------------------------------------------------
# Drift windows — the lexicographic comparison the issue called out
# ---------------------------------------------------------------------------


def _add_job(db, job_id: str, completed_at: datetime, confidence: float = 0.9) -> None:
    db.add(
        InferenceJob(
            id=job_id,
            status="finished",
            model_version="m",
            queued_at=completed_at,
            completed_at=completed_at,
            confidence=confidence,
        )
    )


def test_drift_window_selects_by_instant(db):
    now = utc_now()
    _add_job(db, "in-window", now - timedelta(days=1))
    _add_job(db, "in-baseline", now - timedelta(days=10))
    _add_job(db, "too-old", now - timedelta(days=100))
    db.commit()

    snapshot = compute_drift_snapshot(db, window_days=7, baseline_days=7, persist=False)
    assert snapshot["current"]["inference"]["total"] == 1
    assert snapshot["baseline"]["inference"]["total"] == 1


def test_drift_window_places_a_non_utc_row_correctly(db):
    """A row written in +02:00 lands in the window its instant belongs to.

    As ISO text, ``(now - 1 day)`` rendered with a ``+02:00`` offset can sort
    outside a window it belongs in — the failure mode that made these
    comparisons unreliable.
    """
    now = utc_now()
    _add_job(db, "berlin-row", (now - timedelta(days=1)).astimezone(BERLIN_SUMMER))
    db.commit()

    snapshot = compute_drift_snapshot(db, window_days=7, baseline_days=7, persist=False)
    assert snapshot["current"]["inference"]["total"] == 1


def test_drift_qa_window_uses_created_at(db):
    now = utc_now()
    db.add(
        QACheckResult(id="qa-1", report_id="r", status="pass", created_at=now - timedelta(days=1))
    )
    db.add(
        QACheckResult(id="qa-2", report_id="r", status="fail", created_at=now - timedelta(days=10))
    )
    db.commit()

    snapshot = compute_drift_snapshot(db, window_days=7, baseline_days=7, persist=False)
    assert snapshot["current"]["qa"]["total"] == 1
    assert snapshot["baseline"]["qa"]["total"] == 1


# ---------------------------------------------------------------------------
# Wire format — the API contract must be untouched
# ---------------------------------------------------------------------------


def test_report_response_timestamps_are_iso_strings_with_utc_offset(client):
    created = client.post(
        "/api/v1/reports/create",
        json={"study_id": "study-ts", "patient_id": "patient-ts"},
    )
    assert created.status_code == 200
    body = created.json()

    for field in ("created_at", "updated_at"):
        value = body[field]
        assert isinstance(value, str), f"{field} must stay a string on the wire"
        assert value.endswith("+00:00"), f"{field} lost its explicit UTC offset: {value}"
        # Round-trips through the stdlib parser the frontend's Date() mirrors.
        assert datetime.fromisoformat(value).tzinfo is not None


def test_audit_event_response_timestamp_is_an_iso_string(client):
    response = client.post("/api/v1/audit-log", json={"eventType": "wire_check"})
    assert response.status_code == 200
    value = response.json()["timestamp"]
    assert isinstance(value, str)
    assert value.endswith("+00:00")


def test_audit_log_listing_is_json_serializable(client):
    client.post("/api/v1/audit-log", json={"eventType": "a", "studyId": "s"})
    response = client.get("/api/v1/audit-log")
    assert response.status_code == 200
    # Would raise if a datetime had leaked into the response body.
    json.dumps(response.json())


# ---------------------------------------------------------------------------
# Regression: the stuck-job check used to read .tzinfo off a str
# ---------------------------------------------------------------------------


def test_inference_status_for_a_queued_job_does_not_error(client, db):
    """Used to raise AttributeError: 'str' object has no attribute 'tzinfo'.

    The stuck-job check subtracts ``queued_at`` from now, which could not work
    while the column held a string — so this endpoint returned 500 for every
    job that was still queued or started.
    """
    db.add(
        InferenceJob(
            id="queued-job",
            status="queued",
            model_version="m",
            queued_at=utc_now(),
        )
    )
    db.commit()

    response = client.get("/api/v1/inference/status/queued-job")
    assert response.status_code == 200
    assert response.json()["status"] == "queued"


def test_inference_status_marks_a_long_stuck_job_failed(client, db):
    db.add(
        InferenceJob(
            id="stuck-job",
            status="started",
            model_version="m",
            queued_at=utc_now() - timedelta(days=1),
        )
    )
    db.commit()

    response = client.get("/api/v1/inference/status/stuck-job")
    assert response.status_code == 200
    assert response.json()["status"] == "failed"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def test_ensure_utc_tags_naive_values():
    naive = datetime(2026, 7, 1, 12, 0)
    assert ensure_utc(naive) == datetime(2026, 7, 1, 12, 0, tzinfo=UTC)


def test_ensure_utc_converts_other_offsets():
    assert ensure_utc(datetime(2026, 7, 1, 14, 0, tzinfo=BERLIN_SUMMER)) == datetime(
        2026, 7, 1, 12, 0, tzinfo=UTC
    )


def test_parse_datetime_accepts_a_trailing_z():
    assert parse_datetime("2026-07-01T12:00:00Z") == datetime(2026, 7, 1, 12, 0, tzinfo=UTC)


def test_parse_datetime_returns_none_for_garbage():
    assert parse_datetime("yesterday") is None
    assert parse_datetime("") is None
    assert parse_datetime(None) is None


def test_format_datetime_renders_utc_offset():
    assert (
        format_datetime(datetime(2026, 7, 1, 14, 0, tzinfo=BERLIN_SUMMER))
        == "2026-07-01T12:00:00+00:00"
    )
    assert format_datetime(None) is None
