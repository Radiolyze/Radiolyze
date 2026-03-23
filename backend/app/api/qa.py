"""QA Rules management API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..deps import get_db
from ..mock_logic import utc_now
from ..models import QARule

router = APIRouter()


class QARuleCreate(BaseModel):
    name: str
    rule_type: str
    config_json: dict = Field(default_factory=dict, alias="config")
    severity: str = "warn"
    description: str | None = None

    class Config:
        populate_by_name = True


class QARuleUpdate(BaseModel):
    name: str | None = None
    rule_type: str | None = None
    config_json: dict | None = Field(default=None, alias="config")
    is_active: bool | None = None
    severity: str | None = None
    description: str | None = None

    class Config:
        populate_by_name = True


class QARuleResponse(BaseModel):
    id: str
    name: str
    rule_type: str
    config: dict = Field(alias="config_json")
    is_active: bool
    severity: str
    description: str | None = None
    created_at: str
    updated_at: str

    class Config:
        populate_by_name = True
        from_attributes = True


@router.get("/api/v1/qa-rules", response_model=list[QARuleResponse])
def list_qa_rules(
    active_only: bool = Query(default=False, alias="activeOnly"),
    db: Session = Depends(get_db),
) -> list[QARuleResponse]:
    query = db.query(QARule)
    if active_only:
        query = query.filter(QARule.is_active)
    rules = query.order_by(QARule.created_at).all()
    return [QARuleResponse.model_validate(r) for r in rules]


@router.post("/api/v1/qa-rules", response_model=QARuleResponse, status_code=201)
def create_qa_rule(payload: QARuleCreate, db: Session = Depends(get_db)) -> QARuleResponse:
    valid_types = {"required_keyword", "min_length", "max_length", "regex_match", "field_present"}
    if payload.rule_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid rule_type. Must be one of: {', '.join(sorted(valid_types))}",
        )
    now = utc_now()
    rule = QARule(
        name=payload.name,
        rule_type=payload.rule_type,
        config_json=payload.config_json,
        severity=payload.severity,
        description=payload.description,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return QARuleResponse.model_validate(rule)


@router.patch("/api/v1/qa-rules/{rule_id}", response_model=QARuleResponse)
def update_qa_rule(
    rule_id: str, payload: QARuleUpdate, db: Session = Depends(get_db)
) -> QARuleResponse:
    rule = db.get(QARule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="QA rule not found")
    if payload.name is not None:
        rule.name = payload.name
    if payload.rule_type is not None:
        rule.rule_type = payload.rule_type
    if payload.config_json is not None:
        rule.config_json = payload.config_json
    if payload.is_active is not None:
        rule.is_active = payload.is_active
    if payload.severity is not None:
        rule.severity = payload.severity
    if payload.description is not None:
        rule.description = payload.description
    rule.updated_at = utc_now()
    db.commit()
    db.refresh(rule)
    return QARuleResponse.model_validate(rule)


@router.delete("/api/v1/qa-rules/{rule_id}", status_code=204)
def delete_qa_rule(rule_id: str, db: Session = Depends(get_db)) -> None:
    rule = db.get(QARule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="QA rule not found")
    db.delete(rule)
    db.commit()
