"""Report template management API with auto-population support."""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..deps import get_db
from ..mock_logic import utc_now
from ..models import ReportTemplate as ReportTemplateModel

router = APIRouter()


class TemplateCreateRequest(BaseModel):
    name: str
    modality: str | None = None
    body_region: str | None = Field(default=None, alias="bodyRegion")
    description: str | None = None
    template_text: str = Field(alias="templateText")
    sections: list[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class TemplateUpdateRequest(BaseModel):
    name: str | None = None
    modality: str | None = None
    body_region: str | None = Field(default=None, alias="bodyRegion")
    description: str | None = None
    template_text: str | None = Field(default=None, alias="templateText")
    sections: list[str] | None = None
    is_active: bool | None = None

    class Config:
        populate_by_name = True


class TemplateResponse(BaseModel):
    id: str
    name: str
    modality: str | None = None
    body_region: str | None = Field(default=None, alias="bodyRegion")
    description: str | None = None
    template_text: str = Field(alias="templateText")
    sections: list[str]
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        populate_by_name = True


class PopulateRequest(BaseModel):
    template_id: str = Field(alias="templateId")
    modality: str | None = None
    body_part: str | None = Field(default=None, alias="bodyPart")
    study_description: str | None = Field(default=None, alias="studyDescription")
    comparison_date: str | None = Field(default=None, alias="comparisonDate")
    patient_age: str | None = Field(default=None, alias="patientAge")
    patient_sex: str | None = Field(default=None, alias="patientSex")

    class Config:
        populate_by_name = True


def _populate_template(template_text: str, variables: dict[str, str]) -> str:
    """Replace {{variable}} placeholders with provided values."""
    result = template_text
    for key, value in variables.items():
        result = result.replace(f"{{{{{key}}}}}", value or "—")
    # Remove unfilled placeholders
    result = re.sub(r"\{\{[^}]+\}\}", "—", result)
    return result


@router.get("/api/v1/report-templates", response_model=list[TemplateResponse])
def list_templates(
    modality: str | None = None,
    active_only: bool = Query(default=True, alias="activeOnly"),
    db: Session = Depends(get_db),
) -> list[TemplateResponse]:
    query = db.query(ReportTemplateModel).filter(
        ReportTemplateModel.prompt_type == "report_template"
    )
    if active_only:
        query = query.filter(ReportTemplateModel.is_active == True)
    templates = query.order_by(ReportTemplateModel.name).all()

    results = []
    for t in templates:
        variables = t.variables or []
        # Filter by modality if the template has modality in variables
        meta = {}
        if isinstance(variables, list) and len(variables) > 0 and isinstance(variables[0], dict):
            meta = {v.get("key", ""): v.get("value", "") for v in variables if isinstance(v, dict)}
        elif isinstance(variables, list):
            meta = {}

        if modality and meta.get("modality") and meta["modality"] != modality:
            continue

        results.append(TemplateResponse(
            id=t.id,
            name=t.name,
            modality=meta.get("modality"),
            bodyRegion=meta.get("body_region"),
            description=meta.get("description", ""),
            templateText=t.template_text,
            sections=[s.strip() for s in t.template_text.split("\n") if s.strip().endswith(":")],
            is_active=t.is_active,
            created_at=t.created_at,
            updated_at=t.updated_at,
        ))
    return results


@router.post("/api/v1/report-templates", response_model=TemplateResponse, status_code=201)
def create_template(payload: TemplateCreateRequest, db: Session = Depends(get_db)) -> TemplateResponse:
    now = utc_now()
    variables = [
        {"key": "modality", "value": payload.modality or ""},
        {"key": "body_region", "value": payload.body_region or ""},
        {"key": "description", "value": payload.description or ""},
    ]
    template = ReportTemplateModel(
        prompt_type="report_template",
        name=payload.name,
        template_text=payload.template_text,
        variables=variables,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return TemplateResponse(
        id=template.id,
        name=template.name,
        modality=payload.modality,
        bodyRegion=payload.body_region,
        description=payload.description,
        templateText=template.template_text,
        sections=payload.sections,
        is_active=template.is_active,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


@router.post("/api/v1/report-templates/populate")
def populate_template(
    payload: PopulateRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Auto-populate a template with DICOM metadata variables."""
    template = db.get(ReportTemplateModel, payload.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    variables = {
        "modality": payload.modality or "",
        "body_part": payload.body_part or "",
        "study_description": payload.study_description or "",
        "comparison_date": payload.comparison_date or "",
        "patient_age": payload.patient_age or "",
        "patient_sex": payload.patient_sex or "",
    }
    populated = _populate_template(template.template_text, variables)
    return {"text": populated, "template_id": template.id, "template_name": template.name}
