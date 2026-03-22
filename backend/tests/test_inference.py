"""Tests for inference queueing API."""

from __future__ import annotations


def test_queue_inference(client):
    # Create a report first
    create_resp = client.post("/api/v1/reports/create", json={
        "study_id": "study-inf",
        "patient_id": "patient-inf",
    })
    report_id = create_resp.json()["id"]

    response = client.post("/api/v1/inference/queue", json={
        "report_id": report_id,
        "study_id": "study-inf",
        "findings_text": "Some findings",
    })
    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"


def test_inference_status_not_found(client):
    response = client.get("/api/v1/inference/status/nonexistent-job")
    assert response.status_code == 404
