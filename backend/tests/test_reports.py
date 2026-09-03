"""Tests for report CRUD operations."""

from __future__ import annotations

from unittest.mock import MagicMock, patch


def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_detailed(client):
    response = client.get("/api/v1/health/detailed")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert "services" in data
    assert data["services"]["database"]["status"] == "ok"
    assert data["services"]["redis"]["status"] == "ok"


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
    create_resp = client.post(
        "/api/v1/reports/create",
        json={
            "study_id": "study-002",
            "patient_id": "patient-002",
        },
    )
    report_id = create_resp.json()["id"]

    # Get
    response = client.get(f"/api/v1/reports/{report_id}")
    assert response.status_code == 200
    assert response.json()["id"] == report_id


def test_get_report_not_found(client):
    response = client.get("/api/v1/reports/nonexistent")
    assert response.status_code == 404


def test_structured_data_uses_the_same_key_on_every_report_route(client):
    """``structured_data`` goes out as ``structuredData`` from all three routes.

    ``GET /reports/{id}`` builds its own Response to carry the ETag header and
    so skips the serializer FastAPI applies to ``response_model``. That
    serializer dumps by alias; the hand-built one did not, so this one route
    used to answer with ``structured_data`` while the list routes -- and the
    OpenAPI schema -- said ``structuredData``.
    """
    created = client.post(
        "/api/v1/reports/create",
        json={"study_id": "study-alias", "patient_id": "patient-alias"},
    ).json()
    report_id = created["id"]

    client.patch(
        f"/api/v1/reports/{report_id}",
        json={"structuredData": {"finding": "no acute abnormality"}},
    )

    single = client.get(f"/api/v1/reports/{report_id}").json()
    listed = next(r for r in client.get("/api/v1/reports").json() if r["id"] == report_id)
    by_patient = next(
        r
        for r in client.get("/api/v1/reports/by-patient/patient-alias").json()
        if r["id"] == report_id
    )

    for name, body in (("single", single), ("list", listed), ("by-patient", by_patient)):
        assert body["structuredData"] == {"finding": "no acute abnormality"}, name
        assert "structured_data" not in body, name


def test_update_report(client):
    create_resp = client.post(
        "/api/v1/reports/create",
        json={
            "study_id": "study-003",
            "patient_id": "patient-003",
        },
    )
    report_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/reports/{report_id}",
        json={
            "findings_text": "New findings text",
        },
    )
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
    create_resp = client.post(
        "/api/v1/reports/create",
        json={
            "study_id": "study-fin",
            "patient_id": "patient-fin",
        },
    )
    report_id = create_resp.json()["id"]

    response = client.post(
        f"/api/v1/reports/{report_id}/finalize",
        json={
            "approvedBy": "Dr. Test",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "finalized"
    assert data["approved_by"] == "Dr. Test"


def test_finalize_broadcasts_the_report_status(client):
    """The queue badge and the approve button only move if `status` is in the payload."""
    with client.websocket_connect("/api/v1/ws") as ws:
        report_id = client.post(
            "/api/v1/reports/create",
            json={"study_id": "study-ws-status", "patient_id": "patient-ws-status"},
        ).json()["id"]

        assert (
            client.post(
                f"/api/v1/reports/{report_id}/finalize",
                json={"approvedBy": "Dr. Test"},
            ).status_code
            == 200
        )

        for _ in range(10):
            message = ws.receive_json()
            if message["type"] == "report_status":
                assert message["reportId"] == report_id
                assert message["payload"]["status"] == "finalized"
                break
        else:
            raise AssertionError("no report_status event arrived")


def test_update_broadcasts_the_report_status(client):
    report_id = client.post(
        "/api/v1/reports/create",
        json={"study_id": "study-ws-patch", "patient_id": "patient-ws-patch"},
    ).json()["id"]

    with client.websocket_connect("/api/v1/ws") as ws:
        assert (
            client.patch(
                f"/api/v1/reports/{report_id}",
                json={"findings_text": "Unauffälliger Befund der miterfassten Organe."},
            ).status_code
            == 200
        )

        for _ in range(10):
            message = ws.receive_json()
            if message["type"] == "report_status":
                assert message["payload"]["status"] == "draft"
                break
        else:
            raise AssertionError("no report_status event arrived")


def test_qa_check(client):
    response = client.post(
        "/api/v1/reports/qa-check",
        json={
            "findings_text": "Kein Hinweis auf akute Pathologie in den sichtbaren Bereichen.",
            "impression_text": "Unauffaelliger Befund.",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "passes" in data
    assert "checks" in data
    assert isinstance(data["checks"], list)


def test_qa_check_empty_findings(client):
    response = client.post(
        "/api/v1/reports/qa-check",
        json={
            "findings_text": "",
            "impression_text": "",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["passes"] is False


def test_asr_transcript_accepts_language_form_field(client):
    """Optional language form field must not break ASR (mock path when MedASR disabled)."""
    files = {"file": ("test.wav", b"fake-audio", "audio/wav")}
    data = {"language": "de-DE"}
    response = client.post("/api/v1/reports/asr-transcript", files=files, data=data)
    assert response.status_code == 200
    body = response.json()
    assert "text" in body
    assert isinstance(body["text"], str)
    assert len(body["text"]) > 0


def test_asr_transcript_sends_language_to_http_backend(client, monkeypatch):
    """When MedASR is enabled, ISO language code is forwarded in multipart form data."""
    monkeypatch.setenv("MEDASR_ENABLED", "true")
    monkeypatch.setenv("MEDASR_FALLBACK_TO_MOCK", "false")

    captured: dict[str, object] = {}

    async def fake_post(self, url, **kwargs):
        captured["url"] = url
        captured["data"] = dict(kwargs.get("data") or {})
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json = MagicMock(return_value={"text": "Hallo Welt", "confidence": 0.91})
        return mock_resp

    create_resp = client.post(
        "/api/v1/reports/create",
        json={"study_id": "study-asr", "patient_id": "patient-asr"},
    )
    report_id = create_resp.json()["id"]

    with patch("httpx.AsyncClient.post", new=fake_post):
        files = {"file": ("dictation.webm", b"\x00\x01", "audio/webm")}
        data = {"report_id": report_id, "language": "de-DE"}
        response = client.post("/api/v1/reports/asr-transcript", files=files, data=data)

    assert response.status_code == 200
    assert response.json()["text"] == "Hallo Welt"
    assert captured.get("data", {}).get("language") == "de"


def test_export_sr_json(client):
    create_resp = client.post(
        "/api/v1/reports/create",
        json={
            "study_id": "study-sr",
            "patient_id": "patient-sr",
        },
    )
    report_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/reports/{report_id}/export-sr?format=json")
    assert response.status_code == 200
    assert "application/dicom+json" in response.headers.get("content-type", "")
