"""Annotations API for training data collection."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..deps import get_db
from ..models import Annotation
from ..utils.time import utc_iso

router = APIRouter()


class Point3D(BaseModel):
    x: float
    y: float
    z: float | None = None


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


AnnotationToolType = Literal[
    "length", "rectangle", "ellipse", "freehand", "bidirectional", "arrow"
]
AnnotationCategory = Literal[
    "nodule", "mass", "infiltrate", "effusion", "fracture", "lesion", "anatomical", "other"
]
AnnotationSeverity = Literal["benign", "indeterminate", "malignant"]
AnnotationLaterality = Literal["left", "right", "bilateral", "midline"]


class AnnotationCreateRequest(BaseModel):
    study_id: str = Field(alias="studyId")
    series_id: str = Field(alias="seriesId")
    instance_id: str = Field(alias="instanceId")
    frame_index: int = Field(alias="frameIndex")
    tool_type: AnnotationToolType = Field(alias="toolType")
    handles: list[Point3D]
    bounding_box: BoundingBox | None = Field(default=None, alias="boundingBox")
    label: str
    category: AnnotationCategory
    severity: AnnotationSeverity | None = None
    notes: str | None = None
    anatomical_region: str | None = Field(default=None, alias="anatomicalRegion")
    laterality: AnnotationLaterality | None = None
    actor_id: str | None = Field(default=None, alias="actorId")
    cornerstone_annotation_uid: str | None = Field(default=None, alias="cornerstoneAnnotationUID")

    class Config:
        populate_by_name = True


class AnnotationUpdateRequest(BaseModel):
    label: str | None = None
    category: AnnotationCategory | None = None
    severity: AnnotationSeverity | None = None
    notes: str | None = None
    anatomical_region: str | None = Field(default=None, alias="anatomicalRegion")
    laterality: AnnotationLaterality | None = None
    handles: list[Point3D] | None = None
    bounding_box: BoundingBox | None = Field(default=None, alias="boundingBox")
    actor_id: str | None = Field(default=None, alias="actorId")

    class Config:
        populate_by_name = True


class AnnotationVerifyRequest(BaseModel):
    actor_id: str = Field(alias="actorId")

    class Config:
        populate_by_name = True


class AnnotationResponse(BaseModel):
    id: str
    study_id: str = Field(alias="studyId")
    series_id: str = Field(alias="seriesId")
    instance_id: str = Field(alias="instanceId")
    frame_index: int = Field(alias="frameIndex")
    tool_type: str = Field(alias="toolType")
    handles: list[Point3D]
    bounding_box: BoundingBox | None = Field(default=None, alias="boundingBox")
    label: str
    category: str
    severity: str | None = None
    notes: str | None = None
    anatomical_region: str | None = Field(default=None, alias="anatomicalRegion")
    laterality: str | None = None
    created_by: str = Field(alias="createdBy")
    created_at: str = Field(alias="createdAt")
    updated_at: str | None = Field(default=None, alias="updatedAt")
    verified_by: str | None = Field(default=None, alias="verifiedBy")
    verified_at: str | None = Field(default=None, alias="verifiedAt")
    cornerstone_annotation_uid: str | None = Field(default=None, alias="cornerstoneAnnotationUID")

    class Config:
        populate_by_name = True


def _serialize_annotation(ann: Annotation) -> AnnotationResponse:
    geometry = ann.geometry_json or {}
    handles_raw = geometry.get("handles", [])
    handles = [Point3D(**h) if isinstance(h, dict) else h for h in handles_raw]
    bbox_raw = geometry.get("bounding_box")
    bbox = BoundingBox(**bbox_raw) if bbox_raw else None

    return AnnotationResponse(
        id=ann.id,
        studyId=ann.study_id,
        seriesId=ann.series_id,
        instanceId=ann.instance_id,
        frameIndex=ann.frame_index,
        toolType=ann.tool_type,
        handles=handles,
        boundingBox=bbox,
        label=ann.label,
        category=ann.category or "other",
        severity=ann.severity,
        notes=ann.notes,
        anatomicalRegion=ann.anatomical_region,
        laterality=ann.laterality,
        createdBy=ann.created_by,
        createdAt=ann.created_at,
        updatedAt=ann.updated_at,
        verifiedBy=ann.verified_by,
        verifiedAt=ann.verified_at,
        cornerstoneAnnotationUID=ann.cornerstone_annotation_uid,
    )


@router.post("/api/v1/annotations", response_model=AnnotationResponse)
def create_annotation(
    payload: AnnotationCreateRequest,
    db: Session = Depends(get_db),
) -> AnnotationResponse:
    now = utc_iso()
    geometry = {
        "handles": [h.model_dump() for h in payload.handles],
    }
    if payload.bounding_box:
        geometry["bounding_box"] = payload.bounding_box.model_dump()

    ann = Annotation(
        study_id=payload.study_id,
        series_id=payload.series_id,
        instance_id=payload.instance_id,
        frame_index=payload.frame_index,
        tool_type=payload.tool_type,
        geometry_json=geometry,
        label=payload.label,
        category=payload.category,
        severity=payload.severity,
        notes=payload.notes,
        anatomical_region=payload.anatomical_region,
        laterality=payload.laterality,
        created_by=payload.actor_id or "anonymous",
        created_at=now,
        cornerstone_annotation_uid=payload.cornerstone_annotation_uid,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)

    add_audit_event(
        db,
        event_type="annotation_created",
        actor_id=payload.actor_id,
        study_id=payload.study_id,
        metadata={"annotation_id": ann.id, "label": ann.label, "category": ann.category},
    )

    return _serialize_annotation(ann)


@router.get("/api/v1/annotations", response_model=list[AnnotationResponse])
def list_annotations(
    study_id: str | None = None,
    series_id: str | None = None,
    category: str | None = None,
    verified_only: bool = False,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> list[AnnotationResponse]:
    query = db.query(Annotation)
    if study_id:
        query = query.filter(Annotation.study_id == study_id)
    if series_id:
        query = query.filter(Annotation.series_id == series_id)
    if category:
        query = query.filter(Annotation.category == category)
    if verified_only:
        query = query.filter(Annotation.verified_by.isnot(None))
    
    annotations = query.order_by(Annotation.created_at.desc()).offset(offset).limit(limit).all()
    return [_serialize_annotation(ann) for ann in annotations]


@router.get("/api/v1/annotations/{annotation_id}", response_model=AnnotationResponse)
def get_annotation(
    annotation_id: str,
    db: Session = Depends(get_db),
) -> AnnotationResponse:
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return _serialize_annotation(ann)


@router.patch("/api/v1/annotations/{annotation_id}", response_model=AnnotationResponse)
def update_annotation(
    annotation_id: str,
    payload: AnnotationUpdateRequest,
    db: Session = Depends(get_db),
) -> AnnotationResponse:
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")

    if payload.label is not None:
        ann.label = payload.label
    if payload.category is not None:
        ann.category = payload.category
    if payload.severity is not None:
        ann.severity = payload.severity
    if payload.notes is not None:
        ann.notes = payload.notes
    if payload.anatomical_region is not None:
        ann.anatomical_region = payload.anatomical_region
    if payload.laterality is not None:
        ann.laterality = payload.laterality
    if payload.handles is not None or payload.bounding_box is not None:
        geometry = ann.geometry_json or {}
        if payload.handles is not None:
            geometry["handles"] = [h.model_dump() for h in payload.handles]
        if payload.bounding_box is not None:
            geometry["bounding_box"] = payload.bounding_box.model_dump()
        ann.geometry_json = geometry

    ann.updated_at = utc_iso()
    db.commit()
    db.refresh(ann)

    add_audit_event(
        db,
        event_type="annotation_updated",
        actor_id=payload.actor_id,
        study_id=ann.study_id,
        metadata={"annotation_id": ann.id},
    )

    return _serialize_annotation(ann)


@router.delete("/api/v1/annotations/{annotation_id}")
def delete_annotation(
    annotation_id: str,
    actor_id: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")

    study_id = ann.study_id
    db.delete(ann)
    db.commit()

    add_audit_event(
        db,
        event_type="annotation_deleted",
        actor_id=actor_id,
        study_id=study_id,
        metadata={"annotation_id": annotation_id},
    )

    return {"status": "deleted"}


@router.post("/api/v1/annotations/{annotation_id}/verify", response_model=AnnotationResponse)
def verify_annotation(
    annotation_id: str,
    payload: AnnotationVerifyRequest,
    db: Session = Depends(get_db),
) -> AnnotationResponse:
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")

    now = utc_iso()
    ann.verified_by = payload.actor_id
    ann.verified_at = now
    ann.updated_at = now
    db.commit()
    db.refresh(ann)

    add_audit_event(
        db,
        event_type="annotation_verified",
        actor_id=payload.actor_id,
        study_id=ann.study_id,
        metadata={"annotation_id": ann.id, "label": ann.label},
    )

    return _serialize_annotation(ann)
