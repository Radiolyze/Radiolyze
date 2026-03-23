"""Tests for peer review / second opinion workflow."""

from __future__ import annotations


def test_request_peer_review(client, sample_report):
    """Requesting a peer review creates a review in 'requested' status."""
    report_id = sample_report["id"]
    resp = client.post(
        f"/api/v1/reports/{report_id}/request-review",
        json={
            "assignedTo": "dr-schmidt",
            "comment": "Bitte Zweitmeinung zu diesem Befund",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "requested"
    assert data["assigned_to"] == "dr-schmidt"
    assert data["comment"] == "Bitte Zweitmeinung zu diesem Befund"
    assert data["report_id"] == report_id


def test_list_peer_reviews(client, sample_report):
    """List endpoint returns created reviews."""
    report_id = sample_report["id"]
    client.post(
        f"/api/v1/reports/{report_id}/request-review",
        json={
            "assignedTo": "dr-schmidt",
        },
    )

    resp = client.get(f"/api/v1/reports/{report_id}/reviews")
    assert resp.status_code == 200
    reviews = resp.json()
    assert len(reviews) == 1
    assert reviews[0]["assigned_to"] == "dr-schmidt"


def test_submit_peer_review(client, sample_report):
    """Submitting a review completes the review with a decision."""
    report_id = sample_report["id"]
    review_resp = client.post(
        f"/api/v1/reports/{report_id}/request-review",
        json={
            "assignedTo": "dr-schmidt",
        },
    )
    review_id = review_resp.json()["id"]

    resp = client.post(
        f"/api/v1/reports/{report_id}/reviews/{review_id}/submit",
        json={
            "reviewComment": "Befund korrekt, stimme zu.",
            "decision": "agree",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["decision"] == "agree"
    assert data["review_comment"] == "Befund korrekt, stimme zu."
    assert data["completed_at"] is not None


def test_submit_already_completed_review(client, sample_report):
    """Submitting to an already-completed review returns 409."""
    report_id = sample_report["id"]
    review_resp = client.post(
        f"/api/v1/reports/{report_id}/request-review",
        json={
            "assignedTo": "dr-schmidt",
        },
    )
    review_id = review_resp.json()["id"]

    client.post(
        f"/api/v1/reports/{report_id}/reviews/{review_id}/submit",
        json={
            "reviewComment": "OK",
            "decision": "agree",
        },
    )
    resp = client.post(
        f"/api/v1/reports/{report_id}/reviews/{review_id}/submit",
        json={
            "reviewComment": "Nochmal",
            "decision": "disagree",
        },
    )
    assert resp.status_code == 409


def test_request_review_nonexistent_report(client):
    """Requesting review for a nonexistent report returns 404."""
    resp = client.post(
        "/api/v1/reports/nonexistent/request-review",
        json={
            "assignedTo": "dr-schmidt",
        },
    )
    assert resp.status_code == 404
