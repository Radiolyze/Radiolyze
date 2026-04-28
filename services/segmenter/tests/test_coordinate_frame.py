"""Verify that the mesh ends up in the correct LPS world coordinates.

The mapping is non-trivial because:
- skimage.measure.marching_cubes returns vertices in (z, y, x) voxel-index order;
- SimpleITK / DICOM stores spacing as (sx, sy, sz) and the direction matrix as
  a row-major 3x3 with **columns** being the unit vectors of the i, j, k axes
  in LPS;
- meshing._voxels_to_world has to reorder + scale + apply direction + add origin.

These tests catch any regression in that pipeline by placing a sphere at a
known voxel index and asserting its mesh centroid lands on the analytically
expected LPS point.
"""

from __future__ import annotations

import numpy as np
import SimpleITK as sitk
import pytest

from app.meshing import build_mesh, _voxels_to_world


def _sphere_mask(shape: tuple[int, int, int], center_zyx: tuple[int, int, int], radius: int) -> np.ndarray:
    z_idx, y_idx, x_idx = np.indices(shape)
    cz, cy, cx = center_zyx
    return (z_idx - cz) ** 2 + (y_idx - cy) ** 2 + (x_idx - cx) ** 2 <= radius**2


def _expected_lps(
    voxel_zyx: tuple[float, float, float],
    *,
    spacing: tuple[float, float, float],
    origin: tuple[float, float, float],
    direction: tuple[float, ...],
) -> np.ndarray:
    """ITK convention: physical = origin + direction @ (i*sx, j*sy, k*sz)."""
    z, y, x = voxel_zyx
    sx, sy, sz = spacing
    ijk_mm = np.array([x * sx, y * sy, z * sz])
    direction_mat = np.array(direction).reshape(3, 3)
    return np.array(origin) + direction_mat @ ijk_mm


def _make_image(
    shape: tuple[int, int, int],
    *,
    spacing: tuple[float, float, float],
    origin: tuple[float, float, float],
    direction: tuple[float, ...],
) -> sitk.Image:
    arr = np.zeros(shape, dtype=np.float32)
    image = sitk.GetImageFromArray(arr)
    image.SetSpacing(spacing)
    image.SetOrigin(origin)
    image.SetDirection(direction)
    return image


def test_voxels_to_world_identity_orientation() -> None:
    """Identity direction + zero origin: voxel (z, y, x) maps to (x*sx, y*sy, z*sz)."""
    image = _make_image((10, 12, 14), spacing=(0.5, 0.6, 0.7), origin=(0, 0, 0),
                        direction=(1, 0, 0, 0, 1, 0, 0, 0, 1))
    verts = np.array([[2, 3, 4], [0, 0, 0], [9, 11, 13]], dtype=np.float64)  # (z, y, x)
    world = _voxels_to_world(verts, image)
    expected = np.array(
        [[4 * 0.5, 3 * 0.6, 2 * 0.7], [0, 0, 0], [13 * 0.5, 11 * 0.6, 9 * 0.7]]
    )
    assert np.allclose(world, expected, atol=1e-6)


def test_voxels_to_world_with_origin() -> None:
    image = _make_image((8, 8, 8), spacing=(1.0, 1.0, 1.0), origin=(100.0, -50.0, 25.0),
                        direction=(1, 0, 0, 0, 1, 0, 0, 0, 1))
    verts = np.array([[3, 2, 1]], dtype=np.float64)
    world = _voxels_to_world(verts, image)
    assert np.allclose(world, np.array([[101.0, -48.0, 28.0]]))


def test_voxels_to_world_with_negative_xy_orientation() -> None:
    """LPS direction with both x- and y-axes flipped (common for axial CT)."""
    direction = (-1, 0, 0, 0, -1, 0, 0, 0, 1)
    image = _make_image((4, 4, 4), spacing=(1.0, 1.0, 1.0), origin=(10.0, 20.0, 30.0),
                        direction=direction)
    # Voxel (z=1, y=1, x=1) -> ijk_mm = (1, 1, 1) -> direction @ (1,1,1) = (-1, -1, 1)
    # plus origin (10, 20, 30) = (9, 19, 31)
    verts = np.array([[1, 1, 1]], dtype=np.float64)
    world = _voxels_to_world(verts, image)
    assert np.allclose(world, np.array([[9.0, 19.0, 31.0]]))


def test_mesh_centroid_matches_expected_lps_with_anisotropic_spacing(tmp_path) -> None:
    """End-to-end: a sphere at a known voxel must show its centroid at the
    LPS point computed by the standard ITK voxel→physical formula."""
    shape = (24, 32, 32)  # (z, y, x)
    center_zyx = (12, 16, 16)
    spacing = (0.7, 0.7, 1.5)  # (sx, sy, sz)
    origin = (10.0, -5.0, 100.0)
    direction = (1, 0, 0, 0, 1, 0, 0, 0, 1)

    image = _make_image(shape, spacing=spacing, origin=origin, direction=direction)
    mask = _sphere_mask(shape, center_zyx, radius=6)

    job_dir = tmp_path / "centroid-job"
    (job_dir / "meshes").mkdir(parents=True)
    (job_dir / "masks").mkdir(parents=True)

    artifact = build_mesh(
        label_id=1,
        name="bone",
        color=(0.9, 0.8, 0.7),
        mask=mask,
        reference=image,
        job_dir=job_dir,
    )
    assert artifact is not None

    # Read the mask back via SITK and verify the writer preserved the spatial
    # metadata (regression-guards against accidental CopyInformation drops).
    mask_back = sitk.ReadImage(str(artifact.mask_path))
    assert mask_back.GetSpacing() == pytest.approx(spacing)
    assert mask_back.GetOrigin() == pytest.approx(origin)
    assert tuple(round(d, 6) for d in mask_back.GetDirection()) == tuple(
        round(d, 6) for d in direction
    )

    # Decode the GLB and inspect the vertex centroid; it should match the
    # voxel-to-world transform of the sphere center to within ~3 mm, which is
    # the half-resolution of the largest spacing axis.
    import trimesh

    mesh = trimesh.load(artifact.glb_path, file_type="glb", force="mesh")
    centroid = np.asarray(mesh.vertices).mean(axis=0)
    expected = _expected_lps(center_zyx, spacing=spacing, origin=origin, direction=direction)
    assert np.linalg.norm(centroid - expected) < 3.0, (
        f"Mesh centroid {centroid} too far from expected {expected}"
    )


def test_mesh_centroid_with_flipped_orientation(tmp_path) -> None:
    """Same shape, but with a flipped-x direction; centroid must mirror x."""
    shape = (16, 16, 16)
    center_zyx = (8, 8, 8)
    spacing = (1.0, 1.0, 1.0)
    origin = (50.0, 50.0, 50.0)
    direction = (-1, 0, 0, 0, 1, 0, 0, 0, 1)

    image = _make_image(shape, spacing=spacing, origin=origin, direction=direction)
    mask = _sphere_mask(shape, center_zyx, radius=4)

    job_dir = tmp_path / "flipped-job"
    (job_dir / "meshes").mkdir(parents=True)
    (job_dir / "masks").mkdir(parents=True)
    artifact = build_mesh(1, "bone", (1, 1, 1), mask, image, job_dir=job_dir)
    assert artifact is not None

    import trimesh

    mesh = trimesh.load(artifact.glb_path, file_type="glb", force="mesh")
    centroid = np.asarray(mesh.vertices).mean(axis=0)
    expected = _expected_lps(center_zyx, spacing=spacing, origin=origin, direction=direction)
    # With flipped x, expected x = origin_x + (-1) * (cx*sx) = 50 - 8 = 42
    assert np.isclose(expected[0], 42.0)
    assert np.linalg.norm(centroid - expected) < 2.0
