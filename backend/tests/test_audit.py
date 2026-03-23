"""Tests for audit log API."""

from __future__ import annotations


def test_create_audit_event(client):
    response = client.post(
        "/api/v1/audit-log",
        json={
            "eventType": "test_event",
            "actorId": "test-user",
            "metadata": {"key": "value"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["event_type"] == "test_event"
    assert data["actor_id"] == "test-user"


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
