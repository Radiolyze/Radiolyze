"""Guidelines search and management API.

Provides two search modes:
  - /search              – ILIKE fallback (works on SQLite + PostgreSQL)
  - /semantic-search     – vector cosine similarity via embedding service;
                           falls back to ILIKE when no embeddings exist or
                           EMBEDDING_BASE_URL is not configured.

On create/update a background RQ job generates and stores the embedding.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..deps import get_db, require_admin
from ..mock_logic import utc_now
from ..models import Guideline

logger = logging.getLogger(__name__)

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


def _like_search(
    db: Session, q: str, category: str | None, limit: int
) -> list[GuidelineResponse]:
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
    return [
        GuidelineResponse.model_validate(g)
        for g in query.order_by(Guideline.title).limit(limit).all()
    ]


def _enqueue_embed(guideline_id: str) -> None:
    """Enqueue an embedding job; logs and ignores errors (non-critical path)."""
    try:
        from ..queue import get_queue
        from ..tasks import embed_guideline

        get_queue().enqueue(embed_guideline, guideline_id)
    except Exception:
        logger.exception("Failed to enqueue embedding for guideline %s", guideline_id)


@router.get("/api/v1/guidelines/search", response_model=list[GuidelineResponse])
def search_guidelines(
    q: str = Query("", description="Search query"),
    category: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[GuidelineResponse]:
    """Full-text ILIKE search over guideline title, body, and keywords."""
    return _like_search(db, q, category, limit)


@router.get("/api/v1/guidelines/semantic-search", response_model=list[GuidelineResponse])
def semantic_search_guidelines(
    q: str = Query("", description="Semantic search query"),
    category: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[GuidelineResponse]:
    """Vector similarity search over guidelines.

    When EMBEDDING_BASE_URL is configured and guidelines have been embedded,
    returns results ranked by cosine similarity.  Falls back to ILIKE when the
    embedding service is unavailable or no embeddings exist yet.
    """
    from ..utils.embedding import cosine_similarity, embed_text

    query_vec = embed_text(q.strip()) if q.strip() else None

    if query_vec is not None:
        base = db.query(Guideline).filter(
            Guideline.is_active.is_(True),
            Guideline.embedding_status == "done",
        )
        if category:
            base = base.filter(Guideline.category == category)
        candidates = base.all()

        if candidates:
            scored = sorted(
                candidates,
                key=lambda g: cosine_similarity(g.embedding_vec or [], query_vec),
                reverse=True,
            )
            return [GuidelineResponse.model_validate(g) for g in scored[:limit]]
        # No embeddings ready yet – fall through to ILIKE

    return _like_search(db, q, category, limit)


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
    _enqueue_embed(guideline.id)
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
    # Re-embed on any content change
    text_fields = {"title", "body", "keywords"}
    if text_fields.intersection(payload.model_dump(exclude_unset=True)):
        guideline.embedding_status = "pending"
    db.commit()
    db.refresh(guideline)
    _enqueue_embed(guideline.id)
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
