"""Guidelines search and management API.

Provides full-text search over institutional radiology guidelines using a
simple LIKE-based fallback that works on both PostgreSQL and SQLite (tests).
On PostgreSQL the query relies on B-tree / GIN indexes for performance;
upgrading to ``tsvector`` / pgvector is a transparent data-layer change.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..deps import get_db, require_admin
from ..mock_logic import utc_now
from ..models import Guideline

router = APIRouter()


class GuidelineResponse(BaseModel):
    id: str
    title: str
    category: str
    body: str
    source: str | None = None
    keywords: str | None = None
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class GuidelineCreate(BaseModel):
    title: str
    category: str = "general"
    body: str = ""
    source: str | None = None
    keywords: str | None = None


class GuidelineUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    body: str | None = None
    source: str | None = None
    keywords: str | None = None
    is_active: bool | None = None


@router.get("/api/v1/guidelines/search", response_model=list[GuidelineResponse])
def search_guidelines(
    q: str = Query("", description="Search query"),
    category: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[GuidelineResponse]:
    """Full-text search over guideline title, body, and keywords.

    Returns active guidelines matching the query, ordered by title.
    An empty query returns all active guidelines (respects category filter).
    """
    query = db.query(Guideline).filter(Guideline.is_active.is_(True))

    if category:
        query = query.filter(Guideline.category == category)

    if q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Guideline.title.ilike(pattern),
                Guideline.body.ilike(pattern),
                Guideline.keywords.ilike(pattern),
            )
        )

    results = query.order_by(Guideline.title).limit(limit).all()
    return [GuidelineResponse.model_validate(r) for r in results]


@router.get("/api/v1/guidelines", response_model=list[GuidelineResponse])
def list_guidelines(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[GuidelineResponse]:
    """List all active guidelines with pagination."""
    results = (
        db.query(Guideline)
        .filter(Guideline.is_active.is_(True))
        .order_by(Guideline.category, Guideline.title)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [GuidelineResponse.model_validate(r) for r in results]


@router.post("/api/v1/guidelines", response_model=GuidelineResponse, status_code=201)
def create_guideline(
    payload: GuidelineCreate,
    _: None = require_admin,
    db: Session = Depends(get_db),
) -> GuidelineResponse:
    now = utc_now()
    guideline = Guideline(
        title=payload.title,
        category=payload.category,
        body=payload.body,
        source=payload.source,
        keywords=payload.keywords,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(guideline)
    db.commit()
    db.refresh(guideline)
    return GuidelineResponse.model_validate(guideline)


@router.patch("/api/v1/guidelines/{guideline_id}", response_model=GuidelineResponse)
def update_guideline(
    guideline_id: str,
    payload: GuidelineUpdate,
    _: None = require_admin,
    db: Session = Depends(get_db),
) -> GuidelineResponse:
    guideline = db.get(Guideline, guideline_id)
    if not guideline:
        raise HTTPException(status_code=404, detail="Guideline not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(guideline, field, value)
    guideline.updated_at = utc_now()
    db.commit()
    db.refresh(guideline)
    return GuidelineResponse.model_validate(guideline)


@router.delete("/api/v1/guidelines/{guideline_id}", status_code=204)
def delete_guideline(
    guideline_id: str,
    _: None = require_admin,
    db: Session = Depends(get_db),
) -> None:
    guideline = db.get(Guideline, guideline_id)
    if not guideline:
        raise HTTPException(status_code=404, detail="Guideline not found")
    db.delete(guideline)
    db.commit()
