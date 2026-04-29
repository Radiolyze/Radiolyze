from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import SimpleITK as sitk

from app.manifest import build_manifest, write_manifest
from app.meshing import build_mesh


def _reference_image(shape: tuple[int, int, int] = (24, 32, 32)) -> sitk.Image:
    arr = np.zeros(shape, dtype=np.float32)
    image = sitk.GetImageFromArray(arr)
    image.SetSpacing((0.7, 0.7, 1.2))
    image.SetOrigin((10.0, -5.0, 100.0))
    image.SetDirection((1, 0, 0, 0, 1, 0, 0, 0, 1))
    return image


def _sphere_mask(shape: tuple[int, int, int]) -> np.ndarray:
    z, y, x = shape
    z_idx, y_idx, x_idx = np.indices(shape)
    cz, cy, cx = z // 2, y // 2, x // 2
    radius = min(shape) // 4
    return (z_idx - cz) ** 2 + (y_idx - cy) ** 2 + (x_idx - cx) ** 2 <= radius**2


def test_build_mesh_writes_glb_vtp_and_mask(tmp_path: Path) -> None:
    job_dir = tmp_path / "job-1"
    (job_dir / "meshes").mkdir(parents=True)
    (job_dir / "masks").mkdir(parents=True)

    reference = _reference_image()
    mask = _sphere_mask(reference.GetSize()[::-1])  # SITK GetSize is (x, y, z); arr is (z, y, x)

    artifact = build_mesh(
        label_id=1,
        name="bone",
        color=(0.93, 0.87, 0.74),
        mask=mask,
        reference=reference,
        job_dir=job_dir,
    )
    assert artifact is not None
    assert artifact.glb_path.is_file()
    assert artifact.vtp_path.is_file()
    assert artifact.mask_path.is_file()
    assert artifact.vertex_count > 0
    assert artifact.face_count > 0
    assert artifact.volume_ml > 0


def test_build_mesh_returns_none_for_empty_mask(tmp_path: Path) -> None:
    job_dir = tmp_path / "job-empty"
    (job_dir / "meshes").mkdir(parents=True)
    (job_dir / "masks").mkdir(parents=True)
    reference = _reference_image()
    mask = np.zeros(reference.GetSize()[::-1], dtype=bool)
    assert build_mesh(1, "bone", (1, 1, 1), mask, reference, job_dir=job_dir) is None


def test_target_faces_scales_with_volume() -> None:
    from app.meshing import _max_faces, _target_faces_for

    ceiling = _max_faces()
    # Sub-ml fragments hit the floor.
    assert _target_faces_for(0.1) == max(2_000, ceiling // 10)
    # Mid-volume organs sit between floor and ceiling.
    mid = _target_faces_for(50.0)
    assert max(2_000, ceiling // 10) <= mid < ceiling
    # Large organs saturate at the ceiling.
    assert _target_faces_for(2_000.0) == ceiling


def test_target_faces_respects_env_override(monkeypatch) -> None:
    from app import meshing

    monkeypatch.setenv("MESH_MAX_FACES", "5000")
    # _max_faces is read fresh each call, no module reload needed.
    assert meshing._max_faces() == 5_000
    assert meshing._target_faces_for(2_000.0) == 5_000


def test_manifest_atomic_write(tmp_path: Path) -> None:
    job_dir = tmp_path / "job-2"
    (job_dir / "meshes").mkdir(parents=True)
    (job_dir / "masks").mkdir(parents=True)
    reference = _reference_image()
    mask = _sphere_mask(reference.GetSize()[::-1])
    artifact = build_mesh(1, "bone", (0.9, 0.8, 0.7), mask, reference, job_dir=job_dir)
    assert artifact is not None

    manifest = build_manifest(
        job_id="job-2",
        preset="bone",
        study_uid="1.2.3",
        series_uid="1.2.3.4",
        modality="CT",
        reference=reference,
        artifacts=[artifact],
    )
    path = write_manifest(job_dir, manifest)
    assert path.is_file()
    parsed = json.loads(path.read_text(encoding="utf-8"))
    assert parsed["preset"] == "bone"
    assert parsed["labels"][0]["id"] == 1
    assert "/jobs/job-2/mesh/1" in parsed["labels"][0]["mesh_url"]
