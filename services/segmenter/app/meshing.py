from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import SimpleITK as sitk
import trimesh
from skimage.measure import marching_cubes

logger = logging.getLogger(__name__)

# Quadric decimation target so the browser receives a manageable mesh per label.
MAX_FACES = 20_000


@dataclass
class MeshArtifact:
    label_id: int
    name: str
    color: tuple[float, float, float]
    voxel_count: int
    volume_ml: float
    glb_path: Path
    vtp_path: Path
    mask_path: Path
    vertex_count: int
    face_count: int


def _voxels_to_world(verts: np.ndarray, reference: sitk.Image) -> np.ndarray:
    """Map (z, y, x) voxel coordinates from marching_cubes into LPS world mm."""
    spacing = np.array(reference.GetSpacing(), dtype=np.float64)  # (sx, sy, sz)
    origin = np.array(reference.GetOrigin(), dtype=np.float64)
    direction = np.array(reference.GetDirection(), dtype=np.float64).reshape(3, 3)

    # marching_cubes returns rows as (z, y, x); scale by (sz, sy, sx) and
    # reorder to (x, y, z) before applying the patient-orientation matrix.
    scaled = verts * np.array([spacing[2], spacing[1], spacing[0]])
    xyz = scaled[:, [2, 1, 0]]
    return (direction @ xyz.T).T + origin


def _decimate(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    if len(mesh.faces) <= target_faces:
        return mesh
    try:
        simplified = mesh.simplify_quadric_decimation(target_faces)
        if simplified is not None and len(simplified.faces) > 0:
            return simplified
    except Exception:
        logger.warning("Quadric decimation failed; keeping original mesh", exc_info=True)
    return mesh


def _smooth(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    try:
        return trimesh.smoothing.filter_taubin(mesh, iterations=10)
    except Exception:
        logger.warning("Taubin smoothing failed; keeping un-smoothed mesh", exc_info=True)
        return mesh


def _color_to_uint8(color: tuple[float, float, float]) -> tuple[int, int, int, int]:
    r, g, b = color
    return (int(round(r * 255)), int(round(g * 255)), int(round(b * 255)), 255)


def _write_vtp(mesh: trimesh.Trimesh, path: Path) -> None:
    """Minimal VTK XML PolyData (ASCII) writer.

    We keep it dependency-free: vtk.js's vtkXMLPolyDataReader accepts plain
    ASCII polydata so we don't need the full VTK C library here.
    """
    n_verts = len(mesh.vertices)
    n_faces = len(mesh.faces)
    points_str = " ".join(f"{x:.5f}" for v in mesh.vertices for x in v)
    connectivity_str = " ".join(str(int(i)) for f in mesh.faces for i in f)
    offsets_str = " ".join(str((idx + 1) * 3) for idx in range(n_faces))

    xml = (
        '<?xml version="1.0"?>\n'
        '<VTKFile type="PolyData" version="1.0" byte_order="LittleEndian">\n'
        "  <PolyData>\n"
        f'    <Piece NumberOfPoints="{n_verts}" NumberOfVerts="0" NumberOfLines="0" '
        f'NumberOfStrips="0" NumberOfPolys="{n_faces}">\n'
        "      <Points>\n"
        '        <DataArray type="Float32" NumberOfComponents="3" format="ascii">\n'
        f"          {points_str}\n"
        "        </DataArray>\n"
        "      </Points>\n"
        "      <Polys>\n"
        '        <DataArray type="Int32" Name="connectivity" format="ascii">\n'
        f"          {connectivity_str}\n"
        "        </DataArray>\n"
        '        <DataArray type="Int32" Name="offsets" format="ascii">\n'
        f"          {offsets_str}\n"
        "        </DataArray>\n"
        "      </Polys>\n"
        "    </Piece>\n"
        "  </PolyData>\n"
        "</VTKFile>\n"
    )
    path.write_text(xml, encoding="utf-8")


def build_mesh(
    label_id: int,
    name: str,
    color: tuple[float, float, float],
    mask: np.ndarray,
    reference: sitk.Image,
    *,
    job_dir: Path,
) -> MeshArtifact | None:
    if not mask.any():
        return None

    spacing = reference.GetSpacing()  # (sx, sy, sz) mm
    voxel_volume_ml = float(spacing[0] * spacing[1] * spacing[2]) / 1000.0
    voxel_count = int(np.count_nonzero(mask))
    volume_ml = voxel_count * voxel_volume_ml

    try:
        verts, faces, _, _ = marching_cubes(
            mask.astype(np.uint8), level=0.5, allow_degenerate=False
        )
    except (ValueError, RuntimeError) as exc:
        logger.warning("marching_cubes failed for label %s: %s", name, exc)
        return None

    world_verts = _voxels_to_world(verts, reference)
    mesh = trimesh.Trimesh(vertices=world_verts, faces=faces, process=True)
    mesh = _smooth(mesh)
    mesh = _decimate(mesh, MAX_FACES)

    rgba = _color_to_uint8(color)
    mesh.visual.face_colors = np.tile(np.array(rgba, dtype=np.uint8), (len(mesh.faces), 1))
    mesh.metadata.update(
        {
            "label_id": label_id,
            "label_name": name,
            "color": list(color),
            "volume_ml": volume_ml,
        }
    )

    mesh_dir = job_dir / "meshes"
    mask_dir = job_dir / "masks"
    glb_path = mesh_dir / f"{label_id}.glb"
    vtp_path = mesh_dir / f"{label_id}.vtp"
    mask_path = mask_dir / f"{label_id}_{name}.nii.gz"

    glb_data = trimesh.exchange.gltf.export_glb(mesh, include_normals=True)
    glb_path.write_bytes(glb_data)
    _write_vtp(mesh, vtp_path)

    mask_image = sitk.GetImageFromArray(mask.astype(np.uint8))
    mask_image.CopyInformation(reference)
    sitk.WriteImage(mask_image, str(mask_path), useCompression=True)

    return MeshArtifact(
        label_id=label_id,
        name=name,
        color=color,
        voxel_count=voxel_count,
        volume_ml=volume_ml,
        glb_path=glb_path,
        vtp_path=vtp_path,
        mask_path=mask_path,
        vertex_count=len(mesh.vertices),
        face_count=len(mesh.faces),
    )
