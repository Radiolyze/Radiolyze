"""Tests for report CRUD operations."""

from __future__ import annotations


def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_report(client):
    payload = {
        "study_id": "study-001",
        "patient_id": "patient-001",
    }
    response = client.post("/api/v1/reports/create", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["study_id"] == "study-001"
    assert data["patient_id"] == "patient-001"
    assert data["status"] == "pending"
    assert data["findings_text"] == ""
    assert data["impression_text"] == ""


def test_get_report(client):
    # Create first
    create_resp = client.post("/api/v1/reports/create", json={
        "study_id": "study-002",
        "patient_id": "patient-002",
    })
    report_id = create_resp.json()["id"]

    # Get
    response = client.get(f"/api/v1/reports/{report_id}")
    assert response.status_code == 200
    assert response.json()["id"] == report_id


def test_get_report_not_found(client):
    response = client.get("/api/v1/reports/nonexistent")
    assert response.status_code == 404


def test_update_report(client):
    create_resp = client.post("/api/v1/reports/create", json={
        "study_id": "study-003",
        "patient_id": "patient-003",
    })
    report_id = create_resp.json()["id"]

    response = client.patch(f"/api/v1/reports/{report_id}", json={
        "findings_text": "New findings text",
    })
    assert response.status_code == 200
    assert response.json()["findings_text"] == "New findings text"
    assert response.json()["status"] == "draft"


def test_list_reports(client):
    client.post("/api/v1/reports/create", json={"study_id": "s1", "patient_id": "p1"})
    client.post("/api/v1/reports/create", json={"study_id": "s2", "patient_id": "p2"})

    response = client.get("/api/v1/reports")
    assert response.status_code == 200
    assert len(response.json()) >= 2


def test_list_reports_filter_by_status(client):
    client.post("/api/v1/reports/create", json={"study_id": "s1", "patient_id": "p1"})

    response = client.get("/api/v1/reports?status=pending")
    assert response.status_code == 200
    for r in response.json():
        assert r["status"] == "pending"


def test_finalize_report(client):
    create_resp = client.post("/api/v1/reports/create", json={
        "study_id": "study-fin",
        "patient_id": "patient-fin",
    })
    report_id = create_resp.json()["id"]

    response = client.post(f"/api/v1/reports/{report_id}/finalize", json={
        "approvedBy": "Dr. Test",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "finalized"
    assert data["approved_by"] == "Dr. Test"


def test_qa_check(client):
    response = client.post("/api/v1/reports/qa-check", json={
        "findings_text": "Kein Hinweis auf akute Pathologie in den sichtbaren Bereichen.",
        "impression_text": "Unauffaelliger Befund.",
    })
    assert response.status_code == 200
    data = response.json()
    assert "passes" in data
    assert "checks" in data
    assert isinstance(data["checks"], list)


def test_qa_check_empty_findings(client):
    response = client.post("/api/v1/reports/qa-check", json={
        "findings_text": "",
        "impression_text": "",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["passes"] is False


def test_export_sr_json(client):
    create_resp = client.post("/api/v1/reports/create", json={
        "study_id": "study-sr",
        "patient_id": "patient-sr",
    })
    report_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/reports/{report_id}/export-sr?format=json")
    assert response.status_code == 200
    assert "application/dicom+json" in response.headers.get("content-type", "")
