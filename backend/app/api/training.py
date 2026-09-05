"""Training data export API for Radiolyze Fine-Tuning.

Routes only: request/response schemas, the annotation query each endpoint
filters on, and the HTTP shape of the answer. The dataset formats, the ZIP and
the DICOMweb frame fetch live in ``app.services.training_export``.
"""

from __future__ import annotations

import hashlib
import io
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..deps import get_db, require_admin
from ..models import Annotation
from ..services.training_export import (
    ExportFormat,
    build_export_zip,
    build_manifest,
    collect_image_entries,
    fetch_manifest_images,
)
from ..utils.time import IsoDateTime

router = APIRouter()


class ExportRequest(BaseModel):
    format: ExportFormat = "coco"
    study_ids: list[str] | None = Field(default=None, alias="studyIds")
    categories: list[str] | None = None
    verified_only: bool = Field(default=True, alias="verifiedOnly")
    include_images: bool = Field(default=False, alias="includeImages")
    split_ratio: float = Field(default=0.8, alias="splitRatio", ge=0.5, le=0.95)
    anonymize: bool = Field(default=True, description="De-identify PHI in exported data")

    class Config:
        populate_by_name = True


class ExportStats(BaseModel):
    total_annotations: int = Field(alias="totalAnnotations")
    verified_annotations: int = Field(alias="verifiedAnnotations")
    categories: dict[str, int]
    studies: int
    series: int

    class Config:
        populate_by_name = True


class ExportResponse(BaseModel):
    export_id: str = Field(alias="exportId")
    format: str
    created_at: IsoDateTime = Field(alias="createdAt")
    stats: ExportStats
    download_url: str = Field(alias="downloadUrl")

    class Config:
        populate_by_name = True


class ManifestRequest(BaseModel):
    study_ids: list[str] | None = Field(default=None, alias="studyIds")
    categories: list[str] | None = None
    verified_only: bool = Field(default=True, alias="verifiedOnly")
    split_ratio: float = Field(default=0.8, alias="splitRatio", ge=0.5, le=0.95)
    limit: int | None = Field(default=None, ge=1, le=20000)
    check_images: bool = Field(default=False, alias="checkImages")

    class Config:
        populate_by_name = True


def _generate_export_id() -> str:
    """Generate unique export ID."""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    hash_suffix = hashlib.md5(str(datetime.utcnow().timestamp()).encode()).hexdigest()[:6]
    return f"export_{timestamp}_{hash_suffix}"


def _selected_annotations(
    db: Session,
    study_ids: list[str] | None,
    categories: list[str] | None,
    verified_only: bool,
) -> list[Annotation]:
    """Apply the filters the export and manifest endpoints share, in one place."""
    query = db.query(Annotation)

    if study_ids:
        query = query.filter(Annotation.study_id.in_(study_ids))

    if categories:
        query = query.filter(Annotation.category.in_(categories))

    if verified_only:
        query = query.filter(Annotation.verified_by.isnot(None))

    annotations = query.order_by(Annotation.created_at).all()
    if not annotations:
        raise HTTPException(status_code=400, detail="No annotations found matching criteria")
    return annotations


@router.get("/api/v1/training/stats", response_model=ExportStats)
def get_training_stats(
    study_ids: str | None = Query(default=None, alias="studyIds"),
    verified_only: bool = Query(default=False, alias="verifiedOnly"),
    db: Session = Depends(get_db),
) -> ExportStats:
    """Get annotation statistics for training."""
    query = db.query(Annotation)

    if study_ids:
        ids = [s.strip() for s in study_ids.split(",")]
        query = query.filter(Annotation.study_id.in_(ids))

    if verified_only:
        query = query.filter(Annotation.verified_by.isnot(None))

    annotations = query.all()

    # Count categories
    categories: dict[str, int] = {}
    studies = set()
    series = set()
    verified_count = 0

    for ann in annotations:
        cat = ann.category or "other"
        categories[cat] = categories.get(cat, 0) + 1
        studies.add(ann.study_id)
        series.add(f"{ann.study_id}_{ann.series_id}")
        if ann.verified_by:
            verified_count += 1

    return ExportStats(
        totalAnnotations=len(annotations),
        verifiedAnnotations=verified_count,
        categories=categories,
        studies=len(studies),
        series=len(series),
    )


@router.post("/api/v1/training/export")
def export_training_data(
    payload: ExportRequest,
    _: None = require_admin,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Export annotations in specified format."""
    annotations = _selected_annotations(
        db, payload.study_ids, payload.categories, payload.verified_only
    )

    zip_content = build_export_zip(
        payload.format,
        annotations,
        payload.split_ratio,
        payload.include_images,
        payload.anonymize,
    )

    export_id = _generate_export_id()
    filename = f"{export_id}_{payload.format}.zip"

    return StreamingResponse(
        io.BytesIO(zip_content),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/api/v1/training/manifest")
def export_manifest(
    payload: ManifestRequest,
    _: None = require_admin,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Preview manifest entries for data capture."""
    annotations = _selected_annotations(
        db, payload.study_ids, payload.categories, payload.verified_only
    )

    split_idx = int(len(annotations) * payload.split_ratio)
    entries: dict[str, dict[str, Any]] = {}
    collect_image_entries(annotations[:split_idx], "train", entries)
    collect_image_entries(annotations[split_idx:], "val", entries)
    manifest = build_manifest(entries)
    total = len(manifest)
    if payload.limit:
        manifest = manifest[: payload.limit]

    response: dict[str, Any] = {"total": total, "images": manifest}
    if payload.check_images:
        response["status"] = fetch_manifest_images(manifest)
    return response


@router.get("/api/v1/training/categories")
def list_annotation_categories(
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List all annotation categories with counts."""
    results = (
        db.query(Annotation.category, func.count(Annotation.id)).group_by(Annotation.category).all()
    )

    return [{"category": cat or "other", "count": count} for cat, count in results]
