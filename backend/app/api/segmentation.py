from __future__ import annotations

import logging
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..deps import get_current_user, get_db
from ..dicom_client import store_dicom_object
from ..mock_logic import utc_now
from ..models import SegmentationJob, User
from ..schemas_segmentation import (
    PushToPacsResponse,
    SegmentationCreateRequest,
    SegmentationCreateResponse,
    SegmentationManifest,
    SegmentationStatusResponse,
)
from ..segmentation_client import (
    download_dicom_seg,
    stream_mask,
    stream_mesh,
)
from ..services import SegmentationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/segmentation", tags=["segmentation"])


def _audit_mesh_downloads_enabled() -> bool:
    return os.getenv("SEGMENTATION_AUDIT_MESH_DOWNLOADS", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _audit_mesh_access(
    *,
    db: Session,
    record: SegmentationJob,
    label_id: int,
    kind: str,
    fmt: str,
    user: User | None,
) -> None:
    if not _audit_mesh_downloads_enabled():
        return
    add_audit_event(
        db,
        event_type="segmentation_mesh_accessed",
        actor_id=user.id if user is not None else None,
        study_id=record.study_uid,
        metadata={
            "job_id": record.id,
            "label_id": label_id,
            "format": fmt,
            "kind": kind,
            "preset": record.preset,
        },
        source="api",
    )
    db.commit()


@router.post("/jobs", response_model=SegmentationCreateResponse, status_code=202)
def create_segmentation_job(
    payload: SegmentationCreateRequest,
    db: Session = Depends(get_db),
) -> SegmentationCreateResponse:
    service = SegmentationService(db)
    job_id, queued_at = service.create_job(payload)
    return SegmentationCreateResponse(
        job_id=job_id,
        status="queued",
        queued_at=queued_at,
        study_uid=payload.study_uid,
        series_uid=payload.series_uid,
        preset=payload.preset,
    )


@router.get("/jobs/{job_id}", response_model=SegmentationStatusResponse)
def get_segmentation_job(
    job_id: str, db: Session = Depends(get_db)
) -> SegmentationStatusResponse:
    record = db.get(SegmentationJob, job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Segmentation job not found")
    record = SegmentationService(db).refresh_from_segmenter(record)
    manifest = (
        SegmentationManifest.model_validate(record.manifest_json)
        if isinstance(record.manifest_json, dict)
        else None
    )
    return SegmentationStatusResponse(
        job_id=record.id,
        status=record.status,
        progress=record.progress,
        preset=record.preset,
        study_uid=record.study_uid,
        series_uid=record.series_uid,
        queued_at=record.created_at,
        updated_at=record.updated_at,
        manifest=manifest,
        error=record.error_message,
        dicom_seg_orthanc_url=record.dicom_seg_orthanc_url,
    )


@router.get("/jobs/{job_id}/manifest", response_model=SegmentationManifest)
def get_manifest(job_id: str, db: Session = Depends(get_db)) -> SegmentationManifest:
    record = db.get(SegmentationJob, job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Segmentation job not found")
    if not isinstance(record.manifest_json, dict):
        raise HTTPException(status_code=409, detail="Manifest not yet available")
    return SegmentationManifest.model_validate(record.manifest_json)


def _safe_local_path(record: SegmentationJob, *parts: str) -> Path | None:
    if not record.data_dir:
        return None
    base = Path(record.data_dir).resolve()
    candidate = base.joinpath(*parts).resolve()
    try:
        candidate.relative_to(base)
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def _label_filename(record: SegmentationJob, label_id: int) -> str | None:
    manifest = record.manifest_json
    if not isinstance(manifest, dict):
        return None
    for entry in manifest.get("labels", []) or []:
        if int(entry.get("id", -1)) == label_id:
            return f"{label_id}_{entry.get('name', 'label')}.nii.gz"
    return None


@router.get("/jobs/{job_id}/mesh/{label_id}")
def download_mesh(
    job_id: str,
    label_id: int,
    format: Literal["glb", "vtp"] = Query("glb"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> StreamingResponse:
    record = db.get(SegmentationJob, job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Segmentation job not found")

    _audit_mesh_access(
        db=db,
        record=record,
        label_id=label_id,
        kind="mesh",
        fmt=format,
        user=current_user,
    )

    media = "model/gltf-binary" if format == "glb" else "application/vnd.kitware.vtp+xml"
    local = _safe_local_path(record, "meshes", f"{label_id}.{format}")
    if local is not None:
        def _file_iter() -> Iterator[bytes]:
            with local.open("rb") as fh:
                while chunk := fh.read(64 * 1024):
                    yield chunk

        return StreamingResponse(_file_iter(), media_type=media)

    return StreamingResponse(stream_mesh(job_id, label_id, fmt=format), media_type=media)


@router.get("/jobs/{job_id}/mask/{label_id}")
def download_mask(
    job_id: str,
    label_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> StreamingResponse:
    record = db.get(SegmentationJob, job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Segmentation job not found")

    _audit_mesh_access(
        db=db,
        record=record,
        label_id=label_id,
        kind="mask",
        fmt="nii.gz",
        user=current_user,
    )

    filename = _label_filename(record, label_id)
    local = _safe_local_path(record, "masks", filename) if filename else None
    if local is not None:
        def _file_iter() -> Iterator[bytes]:
            with local.open("rb") as fh:
                while chunk := fh.read(64 * 1024):
                    yield chunk

        return StreamingResponse(_file_iter(), media_type="application/octet-stream")
    return StreamingResponse(stream_mask(job_id, label_id), media_type="application/octet-stream")


@router.post("/jobs/{job_id}/push-to-pacs", response_model=PushToPacsResponse)
def push_to_pacs(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> PushToPacsResponse:
    """Forward the job's DICOM SEG to Orthanc via STOW-RS.

    Idempotent: on success the job's `dicom_seg_orthanc_url` column is
    updated, and re-pushing returns the cached URL without re-uploading.
    """
    record = db.get(SegmentationJob, job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Segmentation job not found")
    if record.status != "finished":
        raise HTTPException(
            status_code=409,
            detail=f"Job status is {record.status!r}; needs to be 'finished'",
        )

    manifest = record.manifest_json if isinstance(record.manifest_json, dict) else {}
    if "dicom_seg" not in manifest:
        raise HTTPException(
            status_code=409,
            detail=(
                "DICOM SEG was not generated for this job (segmenter rebuild "
                "with pydicom-seg required, or SEGMENTATION_GENERATE_DICOM_SEG=false)."
            ),
        )

    pushed_at = utc_now()
    actor_id = current_user.id if current_user is not None else None
    seg_meta = manifest.get("dicom_seg") or {}

    try:
        seg_bytes = download_dicom_seg(job_id)
    except Exception as exc:
        logger.exception("Failed to fetch DICOM SEG from segmenter for %s", job_id)
        add_audit_event(
            db,
            event_type="segmentation_push_failed",
            actor_id=actor_id,
            study_id=record.study_uid,
            metadata={
                "job_id": job_id,
                "stage": "fetch",
                "error": str(exc),
            },
            timestamp=pushed_at,
            source="api",
        )
        db.commit()
        raise HTTPException(
            status_code=502, detail=f"Could not fetch DICOM SEG: {exc}"
        ) from exc

    try:
        orthanc_url = store_dicom_object(record.study_uid, seg_bytes)
    except Exception as exc:
        logger.exception("Failed to STOW-RS DICOM SEG for %s", job_id)
        add_audit_event(
            db,
            event_type="segmentation_push_failed",
            actor_id=actor_id,
            study_id=record.study_uid,
            metadata={
                "job_id": job_id,
                "stage": "stow_rs",
                "error": str(exc),
            },
            timestamp=pushed_at,
            source="api",
        )
        db.commit()
        raise HTTPException(
            status_code=502, detail=f"STOW-RS push failed: {exc}"
        ) from exc

    record.dicom_seg_orthanc_url = orthanc_url
    record.updated_at = pushed_at

    add_audit_event(
        db,
        event_type="segmentation_pushed_to_pacs",
        actor_id=actor_id,
        study_id=record.study_uid,
        metadata={
            "job_id": job_id,
            "preset": record.preset,
            "orthanc_url": orthanc_url,
            "sop_instance_uid": seg_meta.get("sop_instance_uid"),
            "series_instance_uid": seg_meta.get("series_instance_uid"),
            "label_count": seg_meta.get("label_count"),
            "size_bytes": len(seg_bytes),
        },
        timestamp=pushed_at,
        source="api",
    )
    db.commit()

    return PushToPacsResponse(
        job_id=job_id,
        dicom_seg_orthanc_url=orthanc_url,
        pushed_at=pushed_at,
    )


@router.delete("/jobs/{job_id}", status_code=204)
def delete_segmentation_job(job_id: str, db: Session = Depends(get_db)) -> None:
    record = db.get(SegmentationJob, job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Segmentation job not found")
    if record.data_dir:
        base = Path(record.data_dir)
        if base.is_dir():
            for child in sorted(base.rglob("*"), key=lambda p: -len(p.parts)):
                try:
                    child.unlink() if child.is_file() else child.rmdir()
                except OSError:
                    logger.warning("Could not remove %s", child)
            try:
                base.rmdir()
            except OSError:
                pass
    db.delete(record)
    db.commit()
