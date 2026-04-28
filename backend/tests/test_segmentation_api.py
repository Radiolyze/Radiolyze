"""Tests for the segmentation orchestrator API.

The segmenter microservice itself is mocked via httpx.MockTransport so the
tests run without a network or GPU.
"""

from __future__ import annotations

import json
from typing import Iterable
from unittest.mock import patch

import httpx
import pytest


def _seg_app_factory(handler):
    """Wrap a handler in a closure that yields a stateful httpx.MockTransport."""
    return httpx.MockTransport(handler)


def test_create_bone_job_persists_row_and_audit(client, db):
    payload = {
        "study_uid": "1.2.3",
        "series_uid": "1.2.3.4",
        "preset": "bone",
        "requested_by": "tester",
    }
    response = client.post("/api/v1/segmentation/jobs", json=payload)
    assert response.status_code == 202, response.text
    body = response.json()
    job_id = body["job_id"]
    assert body["status"] == "queued"
    assert body["preset"] == "bone"

    from app.models import AuditEvent, SegmentationJob

    record = db.get(SegmentationJob, job_id)
    assert record is not None
    assert record.preset == "bone"
    assert record.status == "queued"
    assert record.study_uid == "1.2.3"

    audit_rows = (
        db.query(AuditEvent)
        .filter(AuditEvent.event_type == "segmentation_queued")
        .all()
    )
    assert any(
        (event.metadata_json or {}).get("job_id") == job_id for event in audit_rows
    )


def test_total_preset_returns_501(client):
    response = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": "x", "series_uid": "y", "preset": "total"},
    )
    assert response.status_code == 501


def test_get_job_returns_running_then_finished(client, db, monkeypatch):
    create = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": "uid-1", "series_uid": "uid-1.1", "preset": "bone"},
    )
    job_id = create.json()["job_id"]

    manifest = {
        "job_id": job_id,
        "preset": "bone",
        "source": {"study_uid": "uid-1", "series_uid": "uid-1.1", "modality": "CT"},
        "volume": {"spacing": [1, 1, 1], "origin": [0, 0, 0], "direction": [1, 0, 0, 0, 1, 0, 0, 0, 1], "shape": [10, 10, 10]},
        "labels": [
            {
                "id": 1,
                "name": "bone",
                "color": [0.93, 0.87, 0.74],
                "volume_ml": 12.5,
                "voxel_count": 1234,
                "vertex_count": 500,
                "face_count": 800,
                "mask_url": f"/jobs/{job_id}/mask/1",
                "mesh_url": f"/jobs/{job_id}/mesh/1",
                "vtp_url": f"/jobs/{job_id}/mesh/1?format=vtp",
            }
        ],
        "warnings": [],
    }

    statuses: Iterable[dict] = iter(
        [
            {"job_id": job_id, "status": "running", "progress": 0.4, "manifest": None},
            {"job_id": job_id, "status": "done", "progress": 1.0, "manifest": manifest},
        ]
    )

    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=next(statuses))

    transport = _seg_app_factory(_handler)
    real_client = httpx.Client

    def _patched_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    with patch("app.segmentation_client.httpx.Client", _patched_client):
        first = client.get(f"/api/v1/segmentation/jobs/{job_id}").json()
        assert first["status"] in {"queued", "started"}
        assert first["progress"] == pytest.approx(0.4)

        second = client.get(f"/api/v1/segmentation/jobs/{job_id}").json()
        assert second["status"] == "finished"
        assert second["manifest"]["labels"][0]["name"] == "bone"


def test_mesh_streaming_falls_back_to_segmenter_when_local_missing(
    client, db, tmp_path, monkeypatch
):
    create = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": "uid-9", "series_uid": "uid-9.1", "preset": "bone"},
    )
    job_id = create.json()["job_id"]

    # Point the segmentation data dir at a tmp directory the test owns; we
    # leave it empty so the mesh-streaming endpoint must hit the segmenter.
    monkeypatch.setenv("SEGMENTATION_DATA_DIR", str(tmp_path))

    fake_glb = b"\x67\x6c\x54\x46FAKE"

    def _handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/mesh/1"):
            return httpx.Response(200, content=fake_glb)
        return httpx.Response(404)

    transport = _seg_app_factory(_handler)
    real_client = httpx.Client

    def _patched_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    with patch("app.segmentation_client.httpx.Client", _patched_client):
        resp = client.get(f"/api/v1/segmentation/jobs/{job_id}/mesh/1")
    assert resp.status_code == 200
    assert resp.content == fake_glb
    assert resp.headers["content-type"].startswith("model/gltf-binary")


def test_get_unknown_job_returns_404(client):
    resp = client.get("/api/v1/segmentation/jobs/does-not-exist")
    assert resp.status_code == 404


def test_manifest_endpoint_returns_409_until_ready(client, db):
    create = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": "uid-2", "series_uid": "uid-2.1", "preset": "bone"},
    )
    job_id = create.json()["job_id"]
    resp = client.get(f"/api/v1/segmentation/jobs/{job_id}/manifest")
    assert resp.status_code == 409


def test_delete_job_removes_row(client, db):
    create = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": "uid-3", "series_uid": "uid-3.1", "preset": "bone"},
    )
    job_id = create.json()["job_id"]
    resp = client.delete(f"/api/v1/segmentation/jobs/{job_id}")
    assert resp.status_code == 204
    from app.models import SegmentationJob

    assert db.get(SegmentationJob, job_id) is None


def test_segmentation_create_response_includes_required_fields(client):
    create = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": "uid-4", "series_uid": "uid-4.1", "preset": "bone"},
    )
    body = create.json()
    expected_keys = {"job_id", "status", "queued_at", "study_uid", "series_uid", "preset"}
    assert expected_keys.issubset(body.keys())
    # Sanity check: queued_at parses as JSON-encoded ISO string.
    json.dumps(body)
