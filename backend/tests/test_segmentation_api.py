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


def test_total_preset_is_accepted(client, db):
    """M2: TotalSegmentator preset is now wired; jobs queue normally."""
    response = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": "x", "series_uid": "y", "preset": "total"},
    )
    assert response.status_code == 202
    body = response.json()
    assert body["preset"] == "total"

    from app.models import SegmentationJob

    record = db.get(SegmentationJob, body["job_id"])
    assert record is not None
    assert record.preset == "total"


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


def test_mesh_access_audit_disabled_by_default(client, db, tmp_path, monkeypatch):
    """SEGMENTATION_AUDIT_MESH_DOWNLOADS off (default) → no audit event per fetch."""
    monkeypatch.setenv("SEGMENTATION_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("SEGMENTATION_AUDIT_MESH_DOWNLOADS", raising=False)

    create = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": "audit-1", "series_uid": "audit-1.1", "preset": "bone"},
    )
    job_id = create.json()["job_id"]

    fake_glb = b"\x67\x6c\x54\x46noaudit"

    def _handler(request):
        return httpx.Response(200, content=fake_glb)

    transport = httpx.MockTransport(_handler)
    real_client = httpx.Client

    def _patched_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    with patch("app.segmentation_client.httpx.Client", _patched_client):
        resp = client.get(f"/api/v1/segmentation/jobs/{job_id}/mesh/1")
    assert resp.status_code == 200

    from app.models import AuditEvent

    rows = (
        db.query(AuditEvent)
        .filter(AuditEvent.event_type == "segmentation_mesh_accessed")
        .all()
    )
    assert rows == []


def test_mesh_access_audit_emitted_when_enabled(
    client, db, tmp_path, monkeypatch
):
    """SEGMENTATION_AUDIT_MESH_DOWNLOADS=true → exactly one event per mesh GET."""
    monkeypatch.setenv("SEGMENTATION_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SEGMENTATION_AUDIT_MESH_DOWNLOADS", "true")

    create = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": "audit-2", "series_uid": "audit-2.1", "preset": "total"},
    )
    job_id = create.json()["job_id"]

    fake_glb = b"\x67\x6c\x54\x46audit-on"

    def _handler(request):
        return httpx.Response(200, content=fake_glb)

    transport = httpx.MockTransport(_handler)
    real_client = httpx.Client

    def _patched_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    with patch("app.segmentation_client.httpx.Client", _patched_client):
        client.get(f"/api/v1/segmentation/jobs/{job_id}/mesh/7")
        client.get(f"/api/v1/segmentation/jobs/{job_id}/mesh/7?format=vtp")

    from app.models import AuditEvent

    rows = (
        db.query(AuditEvent)
        .filter(AuditEvent.event_type == "segmentation_mesh_accessed")
        .order_by(AuditEvent.timestamp)
        .all()
    )
    assert len(rows) == 2
    metadata = [event.metadata_json for event in rows]
    assert all(meta["job_id"] == job_id for meta in metadata)
    assert all(meta["label_id"] == 7 for meta in metadata)
    assert metadata[0]["format"] == "glb"
    assert metadata[1]["format"] == "vtp"
    assert all(meta["kind"] == "mesh" for meta in metadata)
    assert all(meta["preset"] == "total" for meta in metadata)


def _seed_finished_job(
    client, db, *, study_uid: str, with_seg: bool = True
) -> str:
    """Helper: create a job, then mutate the row into a finished state."""
    create = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": study_uid, "series_uid": f"{study_uid}.1", "preset": "bone"},
    )
    job_id = create.json()["job_id"]

    from app.models import SegmentationJob

    record = db.get(SegmentationJob, job_id)
    record.status = "finished"
    base_manifest = {
        "job_id": job_id,
        "preset": "bone",
        "source": {
            "study_uid": study_uid,
            "series_uid": f"{study_uid}.1",
            "modality": "CT",
        },
        "volume": {
            "spacing": [1.0, 1.0, 1.0],
            "origin": [0.0, 0.0, 0.0],
            "direction": [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
            "shape": [10, 10, 10],
        },
        "labels": [
            {
                "id": 1,
                "name": "bone",
                "color": [0.93, 0.87, 0.74],
                "volume_ml": 10.0,
                "voxel_count": 1000,
                "mask_url": f"/jobs/{job_id}/mask/1",
                "mesh_url": f"/jobs/{job_id}/mesh/1",
            }
        ],
        "warnings": [],
    }
    if with_seg:
        base_manifest["dicom_seg"] = {
            "url": f"/jobs/{job_id}/dicom-seg",
            "label_count": 1,
            "sop_instance_uid": "1.2.840.0",
            "series_instance_uid": "1.2.840.1",
            "study_instance_uid": study_uid,
        }
    record.manifest_json = base_manifest
    db.commit()
    return job_id


def test_push_to_pacs_succeeds_and_persists_url(client, db, monkeypatch):
    job_id = _seed_finished_job(client, db, study_uid="push-1")

    fake_seg = b"\x00\x01" + b"DICM-FAKE"
    fake_orthanc_url = "http://orthanc:8042/dicom-web/studies/push-1"

    monkeypatch.setattr(
        "app.api.segmentation.download_dicom_seg",
        lambda jid: fake_seg if jid == job_id else (_ for _ in ()).throw(AssertionError(jid)),
    )
    captured: dict = {}

    def _fake_store(study_uid: str, payload: bytes) -> str:
        captured["study_uid"] = study_uid
        captured["size"] = len(payload)
        return fake_orthanc_url

    monkeypatch.setattr("app.api.segmentation.store_dicom_object", _fake_store)

    response = client.post(f"/api/v1/segmentation/jobs/{job_id}/push-to-pacs")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["job_id"] == job_id
    assert body["dicom_seg_orthanc_url"] == fake_orthanc_url
    assert captured == {"study_uid": "push-1", "size": len(fake_seg)}

    from app.models import AuditEvent, SegmentationJob

    refreshed = db.get(SegmentationJob, job_id)
    assert refreshed.dicom_seg_orthanc_url == fake_orthanc_url

    audit_rows = (
        db.query(AuditEvent)
        .filter(AuditEvent.event_type == "segmentation_pushed_to_pacs")
        .all()
    )
    assert len(audit_rows) == 1
    metadata = audit_rows[0].metadata_json
    assert metadata["job_id"] == job_id
    assert metadata["orthanc_url"] == fake_orthanc_url
    assert metadata["sop_instance_uid"] == "1.2.840.0"
    assert metadata["size_bytes"] == len(fake_seg)


def test_push_to_pacs_rejects_unfinished_jobs(client, db):
    create = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": "push-2", "series_uid": "push-2.1", "preset": "bone"},
    )
    job_id = create.json()["job_id"]
    response = client.post(f"/api/v1/segmentation/jobs/{job_id}/push-to-pacs")
    assert response.status_code == 409


def test_push_to_pacs_rejects_jobs_without_dicom_seg(client, db):
    job_id = _seed_finished_job(client, db, study_uid="push-3", with_seg=False)
    response = client.post(f"/api/v1/segmentation/jobs/{job_id}/push-to-pacs")
    assert response.status_code == 409
    assert "DICOM SEG" in response.json()["detail"]


def test_push_to_pacs_records_failure_audit_when_orthanc_errors(
    client, db, monkeypatch
):
    job_id = _seed_finished_job(client, db, study_uid="push-4")
    monkeypatch.setattr(
        "app.api.segmentation.download_dicom_seg",
        lambda jid: b"FAKE-SEG",
    )
    def _boom(*_a, **_kw):
        raise RuntimeError("orthanc rejected")

    monkeypatch.setattr("app.api.segmentation.store_dicom_object", _boom)

    response = client.post(f"/api/v1/segmentation/jobs/{job_id}/push-to-pacs")
    assert response.status_code == 502

    from app.models import AuditEvent

    audit_rows = (
        db.query(AuditEvent)
        .filter(AuditEvent.event_type == "segmentation_push_failed")
        .all()
    )
    assert len(audit_rows) == 1
    assert audit_rows[0].metadata_json["stage"] == "stow_rs"


def test_status_endpoint_includes_dicom_seg_orthanc_url(client, db):
    job_id = _seed_finished_job(client, db, study_uid="push-5")
    from app.models import SegmentationJob

    record = db.get(SegmentationJob, job_id)
    record.dicom_seg_orthanc_url = "http://orthanc:8042/dicom-web/studies/push-5"
    db.commit()

    body = client.get(f"/api/v1/segmentation/jobs/{job_id}").json()
    assert body["dicom_seg_orthanc_url"].endswith("/studies/push-5")


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
