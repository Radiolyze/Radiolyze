from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SegmentationPreset = Literal["bone", "total"]
SegmentationStatus = Literal["queued", "started", "running", "finished", "failed"]


class SegmentationCreateRequest(BaseModel):
    study_uid: str = Field(..., min_length=1)
    series_uid: str = Field(..., min_length=1)
    preset: SegmentationPreset = "bone"
    requested_by: str | None = None


class SegmentationCreateResponse(BaseModel):
    job_id: str
    status: SegmentationStatus
    queued_at: str
    study_uid: str
    series_uid: str
    preset: SegmentationPreset


class SegmentationLabel(BaseModel):
    id: int
    name: str
    color: list[float]
    volume_ml: float
    voxel_count: int
    vertex_count: int | None = None
    face_count: int | None = None
    mask_url: str
    mesh_url: str
    vtp_url: str | None = None


class SegmentationManifest(BaseModel):
    job_id: str
    preset: SegmentationPreset
    source: dict
    volume: dict
    labels: list[SegmentationLabel]
    created_at: str | None = None
    warnings: list[str] = Field(default_factory=list)


class SegmentationStatusResponse(BaseModel):
    job_id: str
    status: SegmentationStatus
    progress: float = 0.0
    preset: SegmentationPreset
    study_uid: str
    series_uid: str
    queued_at: str | None = None
    updated_at: str | None = None
    manifest: SegmentationManifest | None = None
    error: str | None = None
    dicom_seg_orthanc_url: str | None = None


class PushToPacsResponse(BaseModel):
    job_id: str
    dicom_seg_orthanc_url: str
    pushed_at: str
