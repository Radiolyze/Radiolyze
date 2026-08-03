"""Service-level tests for CriticalFindingService and PeerReviewService.

The route handlers are thin adapters over these services, so the domain error
paths — a missing entity, a second acknowledgement, a second submission — are
asserted here against the service directly rather than through their HTTP
status-code translation. That also reaches the branches the API tests cannot,
notably the audit actor/display-name split on acknowledgement.
"""

from __future__ import annotations

import pytest

from app.models import AuditEvent, CriticalFindingAlert, PeerReview, Report
from app.schemas import PeerReviewRequest, PeerReviewSubmitRequest
from app.services import CriticalFindingService, PeerReviewService
from app.services.exceptions import ConflictError, NotFoundError
from app.utils.time import utc_now


def _audit_events(db, event_type: str) -> list[AuditEvent]:
    return db.query(AuditEvent).filter(AuditEvent.event_type == event_type).all()


# ---------------------------------------------------------------------------
# CriticalFindingService
# ---------------------------------------------------------------------------


def test_detect_and_record_rejects_unknown_report(db):
    with pytest.raises(NotFoundError):
        CriticalFindingService(db).detect_and_record("does-not-exist")


def test_detect_and_record_returns_only_the_alerts_it_created(db, sample_report):
    """A second scan reports its own hits, not the ones already on the report."""
    report_id = sample_report["id"]
    report = db.get(Report, report_id)
    report.findings_text = "Pneumothorax rechts"
    db.commit()

    service = CriticalFindingService(db)
    first = service.detect_and_record(report_id)
    assert first, "expected the seeded finding to match a rule"

    second = service.detect_and_record(report_id)
    assert len(second) == len(first)
    assert {a.id for a in second}.isdisjoint({a.id for a in first})

    # Both scans persisted, so the report now carries the union of the two.
    assert len(service.list_for_report(report_id)) == len(first) + len(second)


def test_acknowledge_rejects_an_alert_from_another_report(db, sample_report):
    report_id = sample_report["id"]
    alert = CriticalFindingAlert(
        report_id=report_id,
        finding_type="Pneumothorax",
        severity="high",
        notified_at=utc_now(),
    )
    db.add(alert)
    db.commit()

    with pytest.raises(NotFoundError):
        CriticalFindingService(db).acknowledge(
            "some-other-report", alert.id, acknowledged_by="dr-a"
        )


def test_acknowledge_is_not_repeatable(db, sample_report):
    report_id = sample_report["id"]
    alert = CriticalFindingAlert(
        report_id=report_id,
        finding_type="Pneumothorax",
        severity="high",
        notified_at=utc_now(),
    )
    db.add(alert)
    db.commit()

    service = CriticalFindingService(db)
    acknowledged = service.acknowledge(report_id, alert.id, acknowledged_by="dr-a")
    assert acknowledged.acknowledged_at is not None

    with pytest.raises(ConflictError):
        service.acknowledge(report_id, alert.id, acknowledged_by="dr-b")


def test_acknowledge_audits_the_caller_not_the_supplied_name(db, sample_report):
    """The client-supplied display name must not become the audit identity."""
    report_id = sample_report["id"]
    alert = CriticalFindingAlert(
        report_id=report_id,
        finding_type="Aortendissektion",
        severity="critical",
        notified_at=utc_now(),
    )
    db.add(alert)
    db.commit()

    CriticalFindingService(db).acknowledge(
        report_id,
        alert.id,
        acknowledged_by="Dr. Someone Else",
        actor_id="user-42",
    )

    events = _audit_events(db, "critical_finding_acknowledged")
    assert len(events) == 1
    assert events[0].actor_id == "user-42"
    # The supplied name is still what the alert displays.
    assert db.get(CriticalFindingAlert, alert.id).acknowledged_by == "Dr. Someone Else"


def test_acknowledge_falls_back_to_the_supplied_name_without_a_caller(db, sample_report):
    """Unauthenticated deployments (AUTH_REQUIRED=false) have no caller identity."""
    report_id = sample_report["id"]
    alert = CriticalFindingAlert(
        report_id=report_id,
        finding_type="Pneumothorax",
        severity="high",
        notified_at=utc_now(),
    )
    db.add(alert)
    db.commit()

    CriticalFindingService(db).acknowledge(report_id, alert.id, acknowledged_by="dr-a")

    events = _audit_events(db, "critical_finding_acknowledged")
    assert [e.actor_id for e in events] == ["dr-a"]


# ---------------------------------------------------------------------------
# PeerReviewService
# ---------------------------------------------------------------------------


def test_request_rejects_unknown_report(db):
    with pytest.raises(NotFoundError):
        PeerReviewService(db).request(
            "does-not-exist", PeerReviewRequest(assigned_to="dr-b", comment="please look")
        )


def test_submit_rejects_a_review_from_another_report(db, sample_report):
    review = PeerReviewService(db).request(
        sample_report["id"], PeerReviewRequest(assigned_to="dr-b", comment=None)
    )

    with pytest.raises(NotFoundError):
        PeerReviewService(db).submit(
            "some-other-report",
            review.id,
            PeerReviewSubmitRequest(decision="agree", review_comment=""),
        )


def test_submit_is_not_repeatable(db, sample_report):
    service = PeerReviewService(db)
    review = service.request(
        sample_report["id"], PeerReviewRequest(assigned_to="dr-b", comment=None)
    )

    completed = service.submit(
        sample_report["id"],
        review.id,
        PeerReviewSubmitRequest(decision="agree", review_comment="looks right"),
    )
    assert completed.status == "completed"
    assert completed.completed_at is not None

    with pytest.raises(ConflictError):
        service.submit(
            sample_report["id"],
            review.id,
            PeerReviewSubmitRequest(decision="disagree", review_comment="changed my mind"),
        )


def test_submit_audits_without_a_study_when_the_report_is_gone(db, sample_report):
    """The review outlives its report; the audit event still gets written."""
    report_id = sample_report["id"]
    service = PeerReviewService(db)
    review = service.request(report_id, PeerReviewRequest(assigned_to="dr-b", comment=None))

    db.delete(db.get(Report, report_id))
    db.commit()

    service.submit(
        report_id, review.id, PeerReviewSubmitRequest(decision="agree", review_comment="")
    )

    events = _audit_events(db, "peer_review_submitted")
    assert len(events) == 1
    assert events[0].study_id is None
    assert events[0].actor_id == "dr-b"


def test_list_for_report_is_newest_first(db, sample_report):
    service = PeerReviewService(db)
    for name in ("dr-b", "dr-c", "dr-d"):
        service.request(sample_report["id"], PeerReviewRequest(assigned_to=name, comment=None))

    reviews = service.list_for_report(sample_report["id"])
    assert len(reviews) == 3
    created = [r.created_at for r in reviews]
    assert created == sorted(created, reverse=True)


def test_serialize_carries_the_full_review(db, sample_report):
    service = PeerReviewService(db)
    review = service.request(
        sample_report["id"], PeerReviewRequest(assigned_to="dr-b", comment="second opinion?")
    )
    submitted = service.submit(
        sample_report["id"],
        review.id,
        PeerReviewSubmitRequest(decision="disagree", review_comment="see addendum"),
    )

    payload = PeerReviewService.serialize(submitted)
    assert payload.assigned_to == "dr-b"
    assert payload.comment == "second opinion?"
    assert payload.review_comment == "see addendum"
    assert payload.decision == "disagree"
    assert payload.status == "completed"


def test_unrelated_reviews_stay_out_of_a_report_listing(db, sample_report, client):
    other = client.post(
        "/api/v1/reports/create",
        json={"study_id": "study-002", "patient_id": "patient-002"},
    ).json()

    service = PeerReviewService(db)
    service.request(sample_report["id"], PeerReviewRequest(assigned_to="dr-b", comment=None))
    service.request(other["id"], PeerReviewRequest(assigned_to="dr-c", comment=None))

    assert [r.assigned_to for r in service.list_for_report(sample_report["id"])] == ["dr-b"]
    assert [r.assigned_to for r in service.list_for_report(other["id"])] == ["dr-c"]


def test_peer_review_rows_are_reachable_by_report(db, sample_report):
    """Guards the report_id filter: a bare table scan would pass without it."""
    PeerReviewService(db).request(
        sample_report["id"], PeerReviewRequest(assigned_to="dr-b", comment=None)
    )
    assert db.query(PeerReview).count() == 1
