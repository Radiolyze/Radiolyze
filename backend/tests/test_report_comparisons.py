"""Tests for persisted current↔prior study comparisons (longitudinal context)."""

from __future__ import annotations


def test_create_comparison(client, sample_report):
    """Creating a comparison persists the prior-study pairing."""
    report_id = sample_report["id"]
    resp = client.post(
        f"/api/v1/reports/{report_id}/comparisons",
        json={
            "priorStudyUid": "1.2.3.prior",
            "priorSeriesUid": "1.2.3.prior.1",
            "timeDeltaDays": 42,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_report_id"] == report_id
    assert data["prior_study_uid"] == "1.2.3.prior"
    assert data["prior_series_uid"] == "1.2.3.prior.1"
    assert data["time_delta_days"] == 42
    assert data["created_at"]


def test_create_comparison_minimal(client, sample_report):
    """priorSeriesUid and timeDeltaDays are optional."""
    report_id = sample_report["id"]
    resp = client.post(
        f"/api/v1/reports/{report_id}/comparisons",
        json={"priorStudyUid": "1.2.3.prior"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["prior_study_uid"] == "1.2.3.prior"
    assert data["prior_series_uid"] is None
    assert data["time_delta_days"] is None


def test_list_comparisons(client, sample_report):
    """List endpoint returns created comparisons, newest first."""
    report_id = sample_report["id"]
    client.post(
        f"/api/v1/reports/{report_id}/comparisons",
        json={"priorStudyUid": "1.2.3.prior-a"},
    )
    client.post(
        f"/api/v1/reports/{report_id}/comparisons",
        json={"priorStudyUid": "1.2.3.prior-b"},
    )

    resp = client.get(f"/api/v1/reports/{report_id}/comparisons")
    assert resp.status_code == 200
    comparisons = resp.json()
    assert len(comparisons) == 2
    assert {c["prior_study_uid"] for c in comparisons} == {"1.2.3.prior-a", "1.2.3.prior-b"}


def test_create_comparison_nonexistent_report(client):
    """Creating a comparison for a nonexistent report returns 404."""
    resp = client.post(
        "/api/v1/reports/nonexistent/comparisons",
        json={"priorStudyUid": "1.2.3.prior"},
    )
    assert resp.status_code == 404


def test_list_comparisons_empty(client, sample_report):
    """A report with no comparisons returns an empty list."""
    report_id = sample_report["id"]
    resp = client.get(f"/api/v1/reports/{report_id}/comparisons")
    assert resp.status_code == 200
    assert resp.json() == []
