"""End-to-end smoke for the segmenter HTTP surface.

Mocks `fetch_series_volume` so we don't need a live Orthanc; everything else
(routing, background task, manifest write, mesh streaming) runs through the
real FastAPI stack.
"""

from __future__ import annotations

import time
from pathlib import Path

import numpy as np
import pytest
import SimpleITK as sitk
from fastapi.testclient import TestClient


@pytest.fixture()
def segmenter_app(tmp_path, monkeypatch):
    monkeypatch.setenv("SEGMENTATION_DATA_DIR", str(tmp_path))
    # Re-import so the module-level data_root() picks up the env override on
    # subsequent calls; data_root is computed lazily so this is safe.
    from app import config, dicom_loader  # noqa: F401  (import for monkeypatch path)
    from app import main as segmenter_main

    def _fake_volume(*_args, **_kwargs):
        z, y, x = 24, 32, 32
        arr = np.full((z, y, x), -500.0, dtype=np.float32)
        cz, cy, cx = z // 2, y // 2, x // 2
        radius = 6
        z_idx, y_idx, x_idx = np.indices((z, y, x))
        sphere = (z_idx - cz) ** 2 + (y_idx - cy) ** 2 + (x_idx - cx) ** 2 <= radius**2
        arr[sphere] = 800.0
        image = sitk.GetImageFromArray(arr)
        image.SetSpacing((0.7, 0.7, 1.5))
        image.SetOrigin((10.0, -5.0, 100.0))
        image.SetDirection((1, 0, 0, 0, 1, 0, 0, 0, 1))
        return dicom_loader.LoadedVolume(image=image, modality="CT", instance_count=z)

    async def _fake_fetch(*args, **kwargs):
        return _fake_volume()

    monkeypatch.setattr(segmenter_main, "fetch_series_volume", _fake_fetch)
    return segmenter_main.app


def _wait_for_status(client: TestClient, job_id: str, *, target: str, timeout_s: float = 5.0):
    deadline = time.monotonic() + timeout_s
    last = None
    while time.monotonic() < deadline:
        last = client.get(f"/jobs/{job_id}").json()
        if last["status"] == target:
            return last
        time.sleep(0.05)
    raise AssertionError(f"Timed out waiting for status={target}; last={last}")


def test_bone_pipeline_e2e_smoke(segmenter_app):
    with TestClient(segmenter_app) as client:
        # 1. Health surface
        health = client.get("/health").json()
        assert health["status"] == "ok"
        assert "bone" in health["presets"]

        # 2. Submit job
        job_id = "smoke-job-1"
        response = client.post(
            "/segment/bone",
            json={
                "job_id": job_id,
                "study_uid": "1.2.3",
                "series_uid": "1.2.3.4",
            },
        )
        assert response.status_code == 202
        assert response.json() == {"job_id": job_id, "status": "queued"}

        # 3. Wait for completion
        final = _wait_for_status(client, job_id, target="done")
        assert final["progress"] == pytest.approx(1.0)
        manifest = final["manifest"]
        assert manifest["preset"] == "bone"
        assert len(manifest["labels"]) == 1
        bone = manifest["labels"][0]
        assert bone["name"] == "bone"
        assert bone["volume_ml"] > 0

        # 4. Manifest endpoint matches inline manifest
        assert client.get(f"/jobs/{job_id}/manifest").json()["job_id"] == job_id

        # 5. Mesh download (GLB)
        glb_resp = client.get(f"/jobs/{job_id}/mesh/1")
        assert glb_resp.status_code == 200
        assert len(glb_resp.content) > 100
        assert glb_resp.content.startswith(b"glTF")

        # 6. Mesh download (VTP)
        vtp_resp = client.get(f"/jobs/{job_id}/mesh/1?format=vtp")
        assert vtp_resp.status_code == 200
        assert b"<VTKFile" in vtp_resp.content

        # 7. Mask download (NIfTI octet stream)
        mask_resp = client.get(f"/jobs/{job_id}/mask/1")
        assert mask_resp.status_code == 200
        assert len(mask_resp.content) > 0


def test_bone_pipeline_rejects_non_ct(segmenter_app, monkeypatch):
    from app import dicom_loader, main as segmenter_main

    def _mr_volume():
        arr = np.zeros((8, 16, 16), dtype=np.float32)
        image = sitk.GetImageFromArray(arr)
        image.SetSpacing((1.0, 1.0, 1.0))
        return dicom_loader.LoadedVolume(image=image, modality="MR", instance_count=8)

    async def _fetch_mr(*args, **kwargs):
        return _mr_volume()

    monkeypatch.setattr(segmenter_main, "fetch_series_volume", _fetch_mr)

    with TestClient(segmenter_app) as client:
        client.post(
            "/segment/bone",
            json={"job_id": "smoke-mr", "study_uid": "x", "series_uid": "y"},
        )
        final = _wait_for_status(client, "smoke-mr", target="failed")
        assert "CT" in (final["error"] or "")


def test_total_preset_returns_503_when_totalsegmentator_missing(
    segmenter_app, monkeypatch
):
    from app import main as segmenter_main

    monkeypatch.setattr(segmenter_main, "_totalseg_version", lambda: None)
    with TestClient(segmenter_app) as client:
        response = client.post(
            "/segment/total",
            json={"job_id": "anything", "study_uid": "x", "series_uid": "y"},
        )
        assert response.status_code == 503


def test_total_preset_runs_with_mocked_runner(segmenter_app, monkeypatch):
    """Full /segment/total round-trip with a fake TotalSegmentator runner."""
    from app import main as segmenter_main, segment_total

    monkeypatch.setattr(segmenter_main, "_totalseg_version", lambda: "fake-2.0.0")

    def _fake_runner(*, input, output, task, fast, device, ml=False, quiet=True):
        out = Path(output)
        out.mkdir(parents=True, exist_ok=True)
        # Write two non-empty label masks shaped like the source CT.
        ref = sitk.ReadImage(input)
        shape = ref.GetSize()[::-1]
        for name, center in (("spleen", (8, 16, 16)), ("liver", (8, 12, 12))):
            arr = np.zeros(shape, dtype=np.uint8)
            cz, cy, cx = center
            zi, yi, xi = np.indices(shape)
            arr[(zi - cz) ** 2 + (yi - cy) ** 2 + (xi - cx) ** 2 <= 9] = 1
            label_image = sitk.GetImageFromArray(arr)
            label_image.CopyInformation(ref)
            sitk.WriteImage(
                label_image, str(out / f"{name}.nii.gz"), useCompression=True
            )

    segment_total._set_runner_for_testing(_fake_runner)

    with TestClient(segmenter_app) as client:
        response = client.post(
            "/segment/total",
            json={
                "job_id": "total-job-1",
                "study_uid": "1.2.3",
                "series_uid": "1.2.3.4",
                "options": {"fast": True, "task": "total"},
            },
        )
        assert response.status_code == 202
        final = _wait_for_status(client, "total-job-1", target="done", timeout_s=10.0)
        assert final["status"] == "done"
        manifest = final["manifest"]
        assert manifest["preset"] == "total"
        names = sorted(label["name"] for label in manifest["labels"])
        assert names == ["liver", "spleen"]

    segment_total._set_runner_for_testing(None)


def test_unknown_job_404(segmenter_app):
    with TestClient(segmenter_app) as client:
        assert client.get("/jobs/nope").status_code == 404
        assert client.get("/jobs/nope/manifest").status_code == 404


def test_data_dir_layout_after_pipeline(segmenter_app, tmp_path):
    with TestClient(segmenter_app) as client:
        client.post(
            "/segment/bone",
            json={"job_id": "layout-job", "study_uid": "x", "series_uid": "y"},
        )
        _wait_for_status(client, "layout-job", target="done")

    base = Path(tmp_path) / "layout-job"
    assert (base / "manifest.json").is_file()
    assert (base / "meshes" / "1.glb").is_file()
    assert (base / "meshes" / "1.vtp").is_file()
    assert (base / "masks" / "1_bone.nii.gz").is_file()
