from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..deps import get_db
from ..prompts import (
    ALLOWED_VARIABLES,
    PROMPT_TYPES,
    get_prompt_template,
    list_prompt_templates,
    prompt_config_enabled,
    prompt_max_length,
    template_fingerprint,
    update_prompt_template,
)
from ..schemas import PromptListResponse, PromptTemplateResponse, PromptType, PromptUpdateRequest

router = APIRouter()


def _serialize_prompt(template: dict[str, Any]) -> PromptTemplateResponse:
    prompt_type = template["prompt_type"]
    allowed = sorted(ALLOWED_VARIABLES[prompt_type])
    return PromptTemplateResponse(
        promptType=prompt_type,
        name=template["name"],
        templateText=template["template_text"],
        version=template.get("version"),
        isActive=bool(template.get("is_active", True)),
        variables=template.get("variables") or [],
        createdBy=template.get("created_by"),
        createdAt=template.get("created_at"),
        updatedAt=template.get("updated_at"),
        source=template.get("source", "default"),
        defaultText=template.get("default_text", ""),
        editable=prompt_config_enabled(),
        maxLength=prompt_max_length(),
        allowedVariables=allowed,
    )


@router.get("/api/v1/prompts", response_model=PromptListResponse)
def list_prompts(db: Session = Depends(get_db)) -> PromptListResponse:
    prompts = list_prompt_templates(db=db)
    return PromptListResponse(
        editable=prompt_config_enabled(),
        maxLength=prompt_max_length(),
        allowedVariables={ptype: sorted(ALLOWED_VARIABLES[ptype]) for ptype in PROMPT_TYPES},
        prompts=[_serialize_prompt(prompt) for prompt in prompts],
    )


@router.get("/api/v1/prompts/{prompt_type}", response_model=PromptTemplateResponse)
def get_prompt(prompt_type: PromptType, db: Session = Depends(get_db)) -> PromptTemplateResponse:
    template = get_prompt_template(prompt_type, db=db)
    return _serialize_prompt(template)


@router.put("/api/v1/prompts/{prompt_type}", response_model=PromptTemplateResponse)
def update_prompt(
    prompt_type: PromptType,
    payload: PromptUpdateRequest,
    db: Session = Depends(get_db),
) -> PromptTemplateResponse:
    if not prompt_config_enabled():
        raise HTTPException(status_code=403, detail="Prompt configuration disabled")
    try:
        template = update_prompt_template(
            db,
            prompt_type=prompt_type,
            template_text=payload.template_text,
            name=payload.name,
            actor_id=payload.actor_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    add_audit_event(
        db,
        event_type="prompt_updated",
        actor_id=payload.actor_id,
        metadata={
            "prompt_type": prompt_type,
            "version": template.get("version"),
            "variables": template.get("variables") or [],
            "template_hash": template_fingerprint(payload.template_text),
            "template_length": len(payload.template_text),
        },
        source="api",
    )
    db.commit()

    return _serialize_prompt(template)
