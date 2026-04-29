from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from .config import (
    data_root,
    dicom_seg_enabled,
    dicom_web_base_url,
    gpu_available,
    job_dir,
)
from .dicom_loader import LoadedVolume, fetch_series_volume
from .dicom_seg import (
    DicomSegArtifact,
    DicomSegUnavailable,
    build_dicom_seg,
)
from .jobs import registry
from .labels import LabeledMask
from .manifest import build_manifest, write_manifest
from .meshing import build_mesh
from .segment_bone import segment_bone
from .segment_total import (
    TotalSegmentatorUnavailable,
    segment_total,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Radiolyze Segmenter", version="0.1.0")


class SegmentRequest(BaseModel):
    job_id: str = Field(..., min_length=1)
    study_uid: str = Field(..., min_length=1)
    series_uid: str = Field(..., min_length=1)
    dicomweb_base_url: str | None = None
    options: dict[str, object] = Field(default_factory=dict)


class SegmentAck(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: float
    error: str | None = None
    manifest: dict | None = None


def _totalseg_version() -> str | None:
    try:
        from importlib.metadata import version

        return version("totalsegmentator")
    except Exception:
        return None


def _pydicom_seg_version() -> str | None:
    try:
        from importlib.metadata import version

        return version("pydicom-seg")
    except Exception:
        return None


@app.get("/health")
def health() -> dict:
    version = _totalseg_version()
    presets = ["bone"]
    if version is not None:
        presets.append("total")
    return {
        "status": "ok",
        "gpu": gpu_available(),
        "totalseg_version": version,
        "pydicom_seg_version": _pydicom_seg_version(),
        "dicom_seg_enabled": dicom_seg_enabled(),
        "presets": presets,
    }


def _maybe_build_dicom_seg(
    *,
    job_id_value: str,
    preset: str,
    masks: list[LabeledMask],
    loaded: LoadedVolume,
    out_dir: Path,
) -> DicomSegArtifact | None:
    """Best-effort DICOM SEG export; never fails the parent job."""
    if not dicom_seg_enabled():
        return None
    if not masks:
        return None
    if loaded.source_datasets is None:
        logger.warning(
            "Skipping DICOM SEG for %s: source datasets were not retained.", job_id_value
        )
        return None
    try:
        return build_dicom_seg(
            masks=masks,
            source_datasets=loaded.source_datasets,
            reference=loaded.image,
            output_path=out_dir / "segmentation.dcm",
            series_description=f"Radiolyze {preset} segmentation",
        )
    except DicomSegUnavailable as exc:
        logger.info("DICOM SEG export skipped: %s", exc)
        return None
    except Exception:
        logger.exception("DICOM SEG export failed for %s; mesh export already done", job_id_value)
        return None


def _resolve_base_url(request: SegmentRequest) -> str:
    return (request.dicomweb_base_url or dicom_web_base_url()).rstrip("/")


async def _run_bone_pipeline(req: SegmentRequest) -> None:
    base_url = _resolve_base_url(req)
    out_dir = job_dir(req.job_id)
    registry.update(req.job_id, status="running", progress=0.05)

    loaded = await fetch_series_volume(base_url, req.study_uid, req.series_uid)
    registry.update(req.job_id, progress=0.4)

    if loaded.modality not in {"CT", "CTA"}:
        raise RuntimeError(
            f"Bone preset requires a CT series; got modality={loaded.modality}"
        )

    masks = segment_bone(loaded.image)
    registry.update(req.job_id, progress=0.6)

    artifacts = []
    warnings: list[str] = []
    for labeled in masks:
        artifact = build_mesh(
            label_id=labeled.label_id,
            name=labeled.name,
            color=labeled.color,
            mask=labeled.array,
            reference=loaded.image,
            job_dir=out_dir,
        )
        if artifact is None:
            warnings.append(f"Empty mask for label {labeled.name}; skipped mesh export.")
            continue
        artifacts.append(artifact)
    registry.update(req.job_id, progress=0.85)

    seg_artifact = _maybe_build_dicom_seg(
        job_id_value=req.job_id,
        preset="bone",
        masks=masks,
        loaded=loaded,
        out_dir=out_dir,
    )
    manifest = build_manifest(
        job_id=req.job_id,
        preset="bone",
        study_uid=req.study_uid,
        series_uid=req.series_uid,
        modality=loaded.modality,
        reference=loaded.image,
        artifacts=artifacts,
        warnings=warnings,
        dicom_seg=seg_artifact,
    )
    write_manifest(out_dir, manifest)
    registry.update(req.job_id, status="done", progress=1.0, manifest=manifest)


async def _run_and_record(req: SegmentRequest) -> None:
    try:
        await _run_bone_pipeline(req)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Job %s failed", req.job_id)
        registry.update(req.job_id, status="failed", error=str(exc))


@app.post("/segment/bone", response_model=SegmentAck, status_code=202)
async def segment_bone_endpoint(
    payload: SegmentRequest, background: BackgroundTasks
) -> SegmentAck:
    registry.create(payload.job_id, preset="bone")
    background.add_task(_run_and_record, payload)
    return SegmentAck(job_id=payload.job_id, status="queued")


async def _run_total_pipeline(req: SegmentRequest) -> None:
    base_url = _resolve_base_url(req)
    out_dir = job_dir(req.job_id)
    registry.update(req.job_id, status="running", progress=0.05)

    loaded = await fetch_series_volume(base_url, req.study_uid, req.series_uid)
    registry.update(req.job_id, progress=0.20)

    if loaded.modality not in {"CT", "CTA"}:
        raise RuntimeError(
            f"TotalSegmentator preset requires a CT series; got modality={loaded.modality}"
        )

    options = req.options or {}
    fast = bool(options.get("fast", True))
    task = str(options.get("task", "total"))

    masks = segment_total(loaded.image, job_dir=out_dir, fast=fast, task=task)
    registry.update(req.job_id, progress=0.65)

    artifacts = []
    warnings: list[str] = []
    for index, labeled in enumerate(masks):
        artifact = build_mesh(
            label_id=labeled.label_id,
            name=labeled.name,
            color=labeled.color,
            mask=labeled.array,
            reference=loaded.image,
            job_dir=out_dir,
        )
        if artifact is None:
            warnings.append(f"Empty mask for label {labeled.name}; skipped mesh export.")
            continue
        artifacts.append(artifact)
        # Per-label progress so the UI can show a slow ramp during meshing.
        registry.update(
            req.job_id,
            progress=0.65 + 0.30 * ((index + 1) / max(len(masks), 1)),
        )
    registry.update(req.job_id, progress=0.95)

    seg_artifact = _maybe_build_dicom_seg(
        job_id_value=req.job_id,
        preset="total",
        masks=masks,
        loaded=loaded,
        out_dir=out_dir,
    )
    manifest = build_manifest(
        job_id=req.job_id,
        preset="total",
        study_uid=req.study_uid,
        series_uid=req.series_uid,
        modality=loaded.modality,
        reference=loaded.image,
        artifacts=artifacts,
        warnings=warnings,
        dicom_seg=seg_artifact,
    )
    write_manifest(out_dir, manifest)
    registry.update(req.job_id, status="done", progress=1.0, manifest=manifest)


async def _run_total_and_record(req: SegmentRequest) -> None:
    try:
        await _run_total_pipeline(req)
    except TotalSegmentatorUnavailable as exc:
        logger.error("TotalSegmentator missing for job %s: %s", req.job_id, exc)
        registry.update(req.job_id, status="failed", error=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Total job %s failed", req.job_id)
        registry.update(req.job_id, status="failed", error=str(exc))


@app.post("/segment/total", response_model=SegmentAck, status_code=202)
async def segment_total_endpoint(
    payload: SegmentRequest, background: BackgroundTasks
) -> SegmentAck:
    if _totalseg_version() is None:
        return JSONResponse(  # type: ignore[return-value]
            status_code=503,
            content={
                "detail": (
                    "totalsegmentator is not installed in this image. "
                    "Rebuild with the M2 requirements."
                ),
                "job_id": payload.job_id,
            },
        )
    registry.create(payload.job_id, preset="total")
    background.add_task(_run_total_and_record, payload)
    return SegmentAck(job_id=payload.job_id, status="queued")


def _load_manifest(job_id: str) -> dict | None:
    manifest_path = data_root() / job_id / "manifest.json"
    if not manifest_path.is_file():
        return None
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
def job_status(job_id: str) -> JobStatusResponse:
    state = registry.get(job_id)
    manifest = state.manifest if state else None
    if manifest is None:
        manifest = _load_manifest(job_id)
    if state is None and manifest is None:
        raise HTTPException(status_code=404, detail="Unknown job")
    return JobStatusResponse(
        job_id=job_id,
        status=state.status if state else "done",
        progress=state.progress if state else 1.0,
        error=state.error if state else None,
        manifest=manifest,
    )


@app.get("/jobs/{job_id}/manifest")
def job_manifest(job_id: str) -> dict:
    manifest = _load_manifest(job_id)
    if manifest is None:
        raise HTTPException(status_code=404, detail="Manifest not yet available")
    return manifest


def _safe_label_path(job_id: str, label_id: int, *, kind: Literal["mesh", "mask"], ext: str) -> Path:
    if kind == "mesh":
        sub = "meshes"
        filename = f"{label_id}.{ext}"
    else:
        # Find the mask by label prefix (filenames embed the label name).
        manifest = _load_manifest(job_id) or {}
        label_entry = next(
            (item for item in manifest.get("labels", []) if int(item["id"]) == label_id),
            None,
        )
        if not label_entry:
            raise HTTPException(status_code=404, detail="Label not found in manifest")
        sub = "masks"
        filename = f"{label_id}_{label_entry['name']}.nii.gz"

    candidate = (data_root() / job_id / sub / filename).resolve()
    base = (data_root() / job_id).resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Path traversal rejected") from exc
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail=f"{kind} file not found")
    return candidate


@app.get("/jobs/{job_id}/mesh/{label_id}")
def mesh_file(
    job_id: str,
    label_id: int,
    format: Literal["glb", "vtp"] = Query("glb"),
) -> FileResponse:
    ext = "glb" if format == "glb" else "vtp"
    media = "model/gltf-binary" if format == "glb" else "application/vnd.kitware.vtp+xml"
    path = _safe_label_path(job_id, label_id, kind="mesh", ext=ext)
    return FileResponse(path, media_type=media, filename=path.name)


@app.get("/jobs/{job_id}/mask/{label_id}")
def mask_file(job_id: str, label_id: int) -> FileResponse:
    path = _safe_label_path(job_id, label_id, kind="mask", ext="nii.gz")
    return FileResponse(path, media_type="application/octet-stream", filename=path.name)


@app.get("/jobs/{job_id}/dicom-seg")
def dicom_seg_file(job_id: str) -> FileResponse:
    """Return the multi-class DICOM SEG produced after the meshing pass."""
    candidate = (data_root() / job_id / "segmentation.dcm").resolve()
    base = (data_root() / job_id).resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Path traversal rejected") from exc
    if not candidate.is_file():
        raise HTTPException(
            status_code=404,
            detail="DICOM SEG not available (job still running, "
            "pydicom-seg missing, or SEG export disabled)",
        )
    return FileResponse(
        candidate,
        media_type="application/dicom",
        filename=f"{job_id}.dcm",
    )
