"""Tests for inference queueing API."""

from __future__ import annotations


def test_queue_inference(client):
    # Create a report first
    create_resp = client.post(
        "/api/v1/reports/create",
        json={
            "study_id": "study-inf",
            "patient_id": "patient-inf",
        },
    )
    report_id = create_resp.json()["id"]

    response = client.post(
        "/api/v1/inference/queue",
        json={
            "report_id": report_id,
            "study_id": "study-inf",
            "findings_text": "Some findings",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"


def test_inference_status_not_found(client):
    response = client.get("/api/v1/inference/status/nonexistent-job")
    assert response.status_code == 404


def test_worker_publishes_the_report_status_it_just_changed(client, monkeypatch):
    """The worker is what flips a report to `draft`; the queue only learns it from the payload."""
    from app import tasks

    published: list[tuple[str | None, dict]] = []
    monkeypatch.setattr(
        tasks,
        "publish_report_status",
        lambda report_id, payload: published.append((report_id, payload)),
    )

    report_id = client.post(
        "/api/v1/reports/create",
        json={"study_id": "study-worker", "patient_id": "patient-worker"},
    ).json()["id"]
    job_id = client.post(
        "/api/v1/inference/queue",
        json={
            "report_id": report_id,
            "study_id": "study-worker",
            "findings_text": "Kein Hinweis auf ein Infiltrat.",
        },
    ).json()["job_id"]

    tasks.run_inference_job(
        {
            "job_id": job_id,
            "report_id": report_id,
            "study_id": "study-worker",
            "findings_text": "Kein Hinweis auf ein Infiltrat.",
        }
    )

    assert published[-1] == (report_id, {"aiStatus": "idle", "status": "draft"})


def test_worker_payload_omits_the_status_without_a_report():
    """A job without a report has no status to report — the payload must not invent one."""
    from app import tasks

    assert tasks._idle_payload(None) == {"aiStatus": "idle"}
    assert tasks._idle_payload("finalized") == {"aiStatus": "idle", "status": "finalized"}
