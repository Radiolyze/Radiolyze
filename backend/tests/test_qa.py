"""Tests for QA rules CRUD and engine."""

from __future__ import annotations


def test_list_qa_rules_empty(client):
    response = client.get("/api/v1/qa-rules")
    assert response.status_code == 200
    assert response.json() == []


def test_create_qa_rule(client):
    response = client.post(
        "/api/v1/qa-rules",
        json={
            "name": "Findings present",
            "rule_type": "field_present",
            "config": {"target": "findings", "message": "Findings are required"},
            "severity": "fail",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Findings present"
    assert data["is_active"] is True


def test_create_qa_rule_invalid_type(client):
    response = client.post(
        "/api/v1/qa-rules",
        json={
            "name": "Bad rule",
            "rule_type": "invalid_type",
        },
    )
    assert response.status_code == 400


def test_update_qa_rule(client):
    create_resp = client.post(
        "/api/v1/qa-rules",
        json={
            "name": "Min length",
            "rule_type": "min_length",
            "config": {"target": "findings", "min_length": 10},
        },
    )
    rule_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/qa-rules/{rule_id}",
        json={
            "name": "Minimum length check",
            "is_active": False,
        },
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Minimum length check"
    assert response.json()["is_active"] is False


def test_delete_qa_rule(client):
    create_resp = client.post(
        "/api/v1/qa-rules",
        json={
            "name": "To delete",
            "rule_type": "field_present",
        },
    )
    rule_id = create_resp.json()["id"]

    response = client.delete(f"/api/v1/qa-rules/{rule_id}")
    assert response.status_code == 204

    # Confirm deleted
    response = client.get("/api/v1/qa-rules")
    assert all(r["id"] != rule_id for r in response.json())


def test_qa_check_with_custom_rules(client):
    """When custom rules exist, QA check uses them instead of hardcoded logic."""
    # Create a rule requiring findings
    client.post(
        "/api/v1/qa-rules",
        json={
            "name": "Findings required",
            "rule_type": "field_present",
            "config": {"target": "findings", "message": "Befund fehlt"},
            "severity": "fail",
        },
    )

    # QA check with empty findings should fail
    response = client.post(
        "/api/v1/reports/qa-check",
        json={
            "findings_text": "",
            "impression_text": "Some impression",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["passes"] is False

    # QA check with findings should pass
    response = client.post(
        "/api/v1/reports/qa-check",
        json={
            "findings_text": "Normal findings present",
            "impression_text": "Normal",
        },
    )
    assert response.status_code == 200
    assert response.json()["passes"] is True
