"""Tests for report template management."""

from __future__ import annotations


def test_create_template(client):
    """Creating a template returns the template with an ID."""
    resp = client.post("/api/v1/report-templates", json={
        "name": "CT Thorax Standard",
        "templateText": "Fragestellung:\nBefund:\nBeurteilung:",
        "modality": "CT",
        "bodyRegion": "Thorax",
        "description": "Standard CT Thorax Befundvorlage",
        "sections": ["Fragestellung", "Befund", "Beurteilung"],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "CT Thorax Standard"
    assert data["is_active"] is True
    assert "id" in data


def test_list_templates(client):
    """List endpoint returns created templates."""
    client.post("/api/v1/report-templates", json={
        "name": "MR Schädel",
        "templateText": "Fragestellung:\nBefund:\nBeurteilung:",
    })

    resp = client.get("/api/v1/report-templates")
    assert resp.status_code == 200
    templates = resp.json()
    assert len(templates) >= 1
    assert any(t["name"] == "MR Schädel" for t in templates)


def test_populate_template(client):
    """Auto-populating a template substitutes variables."""
    create_resp = client.post("/api/v1/report-templates", json={
        "name": "Dynamic Template",
        "templateText": "Modalität: {{modality}}\nKörperregion: {{body_part}}",
    })
    template_id = create_resp.json()["id"]

    resp = client.post("/api/v1/report-templates/populate", json={
        "templateId": template_id,
        "modality": "CT",
        "bodyPart": "Thorax",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "CT" in data["text"]
    assert "Thorax" in data["text"]


def test_populate_replaces_unfilled_with_dash(client):
    """Unfilled template variables are replaced with em-dash."""
    create_resp = client.post("/api/v1/report-templates", json={
        "name": "Partial Template",
        "templateText": "Modalität: {{modality}}\nAlter: {{patient_age}}",
    })
    template_id = create_resp.json()["id"]

    resp = client.post("/api/v1/report-templates/populate", json={
        "templateId": template_id,
        "modality": "MR",
    })
    assert resp.status_code == 200
    assert "—" in resp.json()["text"]  # em-dash for unfilled


def test_template_schema_endpoint_404(client):
    """Schema endpoint returns 404 for template without schema."""
    create_resp = client.post("/api/v1/report-templates", json={
        "name": "No Schema Template",
        "templateText": "Befund:\nBeurteilung:",
    })
    template_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/report-templates/{template_id}/schema")
    assert resp.status_code == 404
