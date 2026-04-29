from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import SimpleITK as sitk

from .dicom_seg import DicomSegArtifact
from .meshing import MeshArtifact


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_manifest(
    *,
    job_id: str,
    preset: str,
    study_uid: str,
    series_uid: str,
    modality: str,
    reference: sitk.Image,
    artifacts: list[MeshArtifact],
    warnings: list[str] | None = None,
    dicom_seg: DicomSegArtifact | None = None,
) -> dict[str, Any]:
    manifest: dict[str, Any] = {
        "job_id": job_id,
        "preset": preset,
        "source": {
            "study_uid": study_uid,
            "series_uid": series_uid,
            "modality": modality,
        },
        "volume": {
            "spacing": list(reference.GetSpacing()),
            "origin": list(reference.GetOrigin()),
            "direction": list(reference.GetDirection()),
            "shape": list(reference.GetSize()),
        },
        "labels": [
            {
                "id": artifact.label_id,
                "name": artifact.name,
                "color": list(artifact.color),
                "volume_ml": round(artifact.volume_ml, 3),
                "voxel_count": artifact.voxel_count,
                "vertex_count": artifact.vertex_count,
                "face_count": artifact.face_count,
                "mask_url": f"/jobs/{job_id}/mask/{artifact.label_id}",
                "mesh_url": f"/jobs/{job_id}/mesh/{artifact.label_id}",
                "vtp_url": f"/jobs/{job_id}/mesh/{artifact.label_id}?format=vtp",
            }
            for artifact in artifacts
        ],
        "created_at": _now_iso(),
        "warnings": warnings or [],
    }
    if dicom_seg is not None:
        manifest["dicom_seg"] = {
            "url": f"/jobs/{job_id}/dicom-seg",
            "label_count": dicom_seg.label_count,
            "sop_instance_uid": dicom_seg.sop_instance_uid,
            "series_instance_uid": dicom_seg.series_instance_uid,
            "study_instance_uid": dicom_seg.study_instance_uid,
        }
    return manifest


def write_manifest(job_dir: Path, manifest: dict[str, Any]) -> Path:
    """Atomically write `manifest.json` so readers never see partial data."""
    target = job_dir / "manifest.json"
    tmp = target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    os.replace(tmp, target)
    return target
