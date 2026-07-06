"""Tests for audit log API."""

from __future__ import annotations

import os
from unittest.mock import patch


def test_create_audit_event(client):
    response = client.post(
        "/api/v1/audit-log",
        json={
            "eventType": "test_event",
            # actorId is client-supplied and must be ignored: in dev mode
            # (AUTH_REQUIRED=false, no bearer token) there is no
            # authenticated caller, so the stored actor is None rather than
            # whatever the client claims.
            "actorId": "test-user",
            "metadata": {"key": "value"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["event_type"] == "test_event"
    assert data["actor_id"] is None
    assert data["seq"] == 1
    assert data["prev_hash"] is None
    assert data["event_hash"]


def test_create_audit_event_uses_authenticated_actor(client, seed_radiologist):
    """When a caller is authenticated, actor_id comes from the token, not the body."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"username": "testradiologist", "password": "radiopass"},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        response = client.post(
            "/api/v1/audit-log",
            json={"eventType": "test_event", "actorId": "spoofed-actor"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    assert response.json()["actor_id"] == seed_radiologist


def test_list_audit_events(client):
    # Create some events
    client.post("/api/v1/audit-log", json={"eventType": "event_1", "studyId": "study-a"})
    client.post("/api/v1/audit-log", json={"eventType": "event_2", "studyId": "study-a"})
    client.post("/api/v1/audit-log", json={"eventType": "event_3", "studyId": "study-b"})

    # List all
    response = client.get("/api/v1/audit-log")
    assert response.status_code == 200
    assert len(response.json()) >= 3

    # Filter by study
    response = client.get("/api/v1/audit-log?study_id=study-a")
    assert response.status_code == 200
    events = response.json()
    assert all(e["study_id"] == "study-a" for e in events)


def test_hash_chain_links_sequential_events(client):
    e1 = client.post("/api/v1/audit-log", json={"eventType": "event_1"}).json()
    e2 = client.post("/api/v1/audit-log", json={"eventType": "event_2"}).json()
    e3 = client.post("/api/v1/audit-log", json={"eventType": "event_3"}).json()

    assert [e1["seq"], e2["seq"], e3["seq"]] == [1, 2, 3]
    assert e1["prev_hash"] is None
    assert e2["prev_hash"] == e1["event_hash"]
    assert e3["prev_hash"] == e2["event_hash"]


def test_verify_audit_log_valid_chain(client):
    client.post("/api/v1/audit-log", json={"eventType": "event_1"})
    client.post("/api/v1/audit-log", json={"eventType": "event_2"})

    response = client.get("/api/v1/audit-log/verify")
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["brokenSeqs"] == []
    assert data["eventsChecked"] == 2


def test_verify_audit_log_detects_tampering(client, db):
    from app.models import AuditEvent

    client.post("/api/v1/audit-log", json={"eventType": "event_1"})
    client.post("/api/v1/audit-log", json={"eventType": "event_2"})
    client.post("/api/v1/audit-log", json={"eventType": "event_3"})

    # Simulate someone editing a row directly in the database after the fact.
    event = db.query(AuditEvent).filter(AuditEvent.seq == 2).one()
    event.event_type = "tampered"
    db.commit()

    response = client.get("/api/v1/audit-log/verify")
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    # The tampered row's own hash no longer matches, and every row chained
    # after it now has a mismatched prev_hash too.
    assert 2 in data["brokenSeqs"]
    assert 3 in data["brokenSeqs"]


def test_add_audit_event_requires_caller_commit(db):
    """add_audit_event() does not commit; a caller rollback discards the event."""
    from app.audit import add_audit_event
    from app.models import AuditEvent

    add_audit_event(db, event_type="uncommitted_event")
    db.rollback()

    remaining = db.query(AuditEvent).filter(AuditEvent.event_type == "uncommitted_event").first()
    assert remaining is None
