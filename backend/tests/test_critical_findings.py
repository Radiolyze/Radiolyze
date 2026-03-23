"""Tests for critical finding alert lifecycle via the API."""

from __future__ import annotations


def test_check_critical_creates_alerts(client, sample_report):
    """Detecting critical findings in report text creates alerts."""
    report_id = sample_report["id"]

    # Update findings with critical content
    client.patch(
        f"/api/v1/reports/{report_id}",
        json={
            "findings_text": "Großer Pneumothorax rechts. Aortendissektion Typ A.",
        },
    )

    resp = client.post(f"/api/v1/reports/{report_id}/check-critical")
    assert resp.status_code == 200
    alerts = resp.json()
    assert len(alerts) >= 2

    finding_types = {a["finding_type"] for a in alerts}
    assert "Pneumothorax" in finding_types
    assert "Aortendissektion" in finding_types


def test_check_critical_no_findings(client, sample_report):
    """A normal report produces no critical alerts."""
    report_id = sample_report["id"]
    resp = client.post(f"/api/v1/reports/{report_id}/check-critical")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_critical_alerts(client, sample_report):
    """List endpoint returns previously created alerts."""
    report_id = sample_report["id"]
    client.patch(
        f"/api/v1/reports/{report_id}",
        json={
            "findings_text": "Pneumothorax rechts",
        },
    )
    client.post(f"/api/v1/reports/{report_id}/check-critical")

    resp = client.get(f"/api/v1/reports/{report_id}/critical-alerts")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_acknowledge_critical_alert(client, sample_report):
    """Acknowledging an alert sets acknowledged_by and timestamp."""
    report_id = sample_report["id"]
    client.patch(
        f"/api/v1/reports/{report_id}",
        json={
            "findings_text": "Pneumothorax rechts",
        },
    )
    alerts_resp = client.post(f"/api/v1/reports/{report_id}/check-critical")
    alert_id = alerts_resp.json()[0]["id"]

    resp = client.patch(
        f"/api/v1/reports/{report_id}/critical-alerts/{alert_id}/acknowledge",
        json={"acknowledgedBy": "dr-mueller"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["acknowledged_by"] == "dr-mueller"
    assert data["acknowledged_at"] is not None


def test_acknowledge_already_acknowledged(client, sample_report):
    """Acknowledging an already-acknowledged alert returns 409."""
    report_id = sample_report["id"]
    client.patch(
        f"/api/v1/reports/{report_id}",
        json={
            "findings_text": "Pneumothorax rechts",
        },
    )
    alerts_resp = client.post(f"/api/v1/reports/{report_id}/check-critical")
    alert_id = alerts_resp.json()[0]["id"]

    client.patch(
        f"/api/v1/reports/{report_id}/critical-alerts/{alert_id}/acknowledge",
        json={"acknowledgedBy": "dr-mueller"},
    )
    resp = client.patch(
        f"/api/v1/reports/{report_id}/critical-alerts/{alert_id}/acknowledge",
        json={"acknowledgedBy": "dr-schmidt"},
    )
    assert resp.status_code == 409
