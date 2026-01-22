from __future__ import annotations

import hashlib
import os
import re
import time
from typing import Any, Literal

from sqlalchemy import func
from sqlalchemy.orm import Session

from .db import SessionLocal
from .mock_logic import utc_now
from .models import PromptTemplate

PromptType = Literal["system", "summary", "impression"]
PromptSource = Literal["db", "env", "default"]

PROMPT_TYPES: tuple[PromptType, ...] = ("system", "summary", "impression")

PROMPT_ENV_KEYS: dict[PromptType, str] = {
    "system": "VLLM_SYSTEM_PROMPT",
    "summary": "VLLM_IMAGE_SUMMARY_PROMPT",
    "impression": "VLLM_IMAGE_IMPRESSION_PROMPT",
}

DEFAULT_PROMPTS: dict[PromptType, str] = {
    "system": (
        "You are a radiology assistant.\n"
        "Focus only on visible imaging findings.\n"
        "Be concise and avoid speculation.\n"
        "If evidence is insufficient, state the limitation.\n"
        "Do not include patient identifiers or PHI.\n"
        "Use the same language as the provided findings text when possible."
    ),
    "summary": (
        "Task: Summarize the imaging findings from the provided images.\n"
        "If findings text is provided, align with it and correct only obvious conflicts.\n"
        "If findings text is empty, rely solely on the images.\n"
        "Output: 1-2 sentences, no bullet points, no headings.\n"
        "Return only the summary text.\n\n"
        "Findings (optional):\n"
        "{{findings_text}}"
    ),
    "impression": (
        "Task: Draft a concise radiology impression based on the images and findings.\n"
        "Prioritize the most clinically relevant findings.\n"
        "If uncertain, qualify with \"likely\" or \"cannot exclude\".\n"
        "Output: 1-3 short sentences, no bullet points, no headings.\n"
        "Return only the impression text.\n\n"
        "Findings (optional):\n"
        "{{findings_text}}"
    ),
}

ALLOWED_VARIABLES: dict[PromptType, set[str]] = {
    "system": set(),
    "summary": {"findings_text"},
    "impression": {"findings_text"},
}

VARIABLE_PATTERN = re.compile(r"{{\s*([a-zA-Z0-9_]+)\s*}}")

_PROMPT_CACHE: dict[str, dict[str, Any]] = {}


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def prompt_config_enabled() -> bool:
    return _env_flag("PROMPT_CONFIG_ENABLED", False)


def prompt_cache_ttl() -> int:
    value = os.getenv("PROMPT_CACHE_TTL", "30")
    try:
        parsed = int(value)
    except ValueError:
        return 30
    return max(parsed, 5)


def prompt_max_length() -> int:
    value = os.getenv("PROMPT_MAX_LENGTH", "4000")
    try:
        parsed = int(value)
    except ValueError:
        return 4000
    return max(parsed, 128)


def _get_default_prompt(prompt_type: PromptType) -> tuple[str, PromptSource]:
    env_key = PROMPT_ENV_KEYS[prompt_type]
    env_value = os.getenv(env_key)
    if env_value:
        return env_value, "env"
    return DEFAULT_PROMPTS[prompt_type], "default"


def extract_variables(template_text: str) -> list[str]:
    variables = {match.group(1) for match in VARIABLE_PATTERN.finditer(template_text)}
    return sorted(variables)


def validate_prompt_template(prompt_type: PromptType, template_text: str) -> list[str]:
    if not template_text or not template_text.strip():
        raise ValueError("Prompt template cannot be empty.")
    if len(template_text) > prompt_max_length():
        raise ValueError(f"Prompt template exceeds {prompt_max_length()} characters.")

    variables = extract_variables(template_text)
    allowed = ALLOWED_VARIABLES[prompt_type]
    invalid = [var for var in variables if var not in allowed]
    if invalid:
        invalid_str = ", ".join(sorted(invalid))
        raise ValueError(f"Invalid variables: {invalid_str}")
    return variables


def render_prompt(template_text: str, variables: dict[str, Any] | None = None) -> str:
    payload = variables or {}

    def replacer(match: re.Match[str]) -> str:
        key = match.group(1)
        value = payload.get(key)
        if value is None:
            return ""
        return str(value)

    return VARIABLE_PATTERN.sub(replacer, template_text).strip()


def clear_prompt_cache(prompt_type: PromptType | None = None) -> None:
    if prompt_type is None:
        _PROMPT_CACHE.clear()
        return
    _PROMPT_CACHE.pop(prompt_type, None)


def _get_cached_prompt(prompt_type: PromptType) -> dict[str, Any] | None:
    entry = _PROMPT_CACHE.get(prompt_type)
    if not entry:
        return None
    if entry["expires_at"] < time.monotonic():
        _PROMPT_CACHE.pop(prompt_type, None)
        return None
    return entry["data"]


def _set_cached_prompt(prompt_type: PromptType, data: dict[str, Any]) -> None:
    ttl = prompt_cache_ttl()
    _PROMPT_CACHE[prompt_type] = {"expires_at": time.monotonic() + ttl, "data": data}


def _load_active_prompt(db: Session, prompt_type: PromptType) -> PromptTemplate | None:
    return (
        db.query(PromptTemplate)
        .filter(PromptTemplate.prompt_type == prompt_type, PromptTemplate.is_active.is_(True))
        .order_by(PromptTemplate.version.desc())
        .first()
    )


def _seed_prompt(db: Session, prompt_type: PromptType) -> PromptTemplate:
    template_text, _source = _get_default_prompt(prompt_type)
    variables = validate_prompt_template(prompt_type, template_text)
    timestamp = utc_now()
    prompt = PromptTemplate(
        prompt_type=prompt_type,
        name=f"{prompt_type}-default",
        template_text=template_text,
        variables=variables,
        version=1,
        is_active=True,
        created_by="system",
        created_at=timestamp,
        updated_at=timestamp,
    )
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt


def _prompt_from_db(prompt: PromptTemplate, default_text: str) -> dict[str, Any]:
    return {
        "prompt_type": prompt.prompt_type,
        "name": prompt.name,
        "template_text": prompt.template_text,
        "variables": prompt.variables or [],
        "version": prompt.version,
        "is_active": prompt.is_active,
        "created_by": prompt.created_by,
        "created_at": prompt.created_at,
        "updated_at": prompt.updated_at,
        "source": "db",
        "default_text": default_text,
    }


def get_prompt_template(prompt_type: PromptType, db: Session | None = None) -> dict[str, Any]:
    cached = _get_cached_prompt(prompt_type)
    if cached:
        return cached

    default_text, default_source = _get_default_prompt(prompt_type)

    if not prompt_config_enabled():
        data = {
            "prompt_type": prompt_type,
            "name": f"{prompt_type}-default",
            "template_text": default_text,
            "variables": extract_variables(default_text),
            "version": None,
            "is_active": True,
            "created_by": None,
            "created_at": None,
            "updated_at": None,
            "source": default_source,
            "default_text": default_text,
        }
        _set_cached_prompt(prompt_type, data)
        return data

    owns_session = db is None
    session = db or SessionLocal()
    try:
        prompt = _load_active_prompt(session, prompt_type)
        if not prompt:
            prompt = _seed_prompt(session, prompt_type)
        data = _prompt_from_db(prompt, default_text)
        _set_cached_prompt(prompt_type, data)
        return data
    finally:
        if owns_session:
            session.close()


def list_prompt_templates(db: Session | None = None) -> list[dict[str, Any]]:
    return [get_prompt_template(prompt_type, db=db) for prompt_type in PROMPT_TYPES]


def update_prompt_template(
    db: Session,
    *,
    prompt_type: PromptType,
    template_text: str,
    name: str | None,
    actor_id: str | None,
) -> dict[str, Any]:
    variables = validate_prompt_template(prompt_type, template_text)
    timestamp = utc_now()

    latest_version = (
        db.query(func.max(PromptTemplate.version))
        .filter(PromptTemplate.prompt_type == prompt_type)
        .scalar()
    )
    version = int(latest_version or 0) + 1

    db.query(PromptTemplate).filter(
        PromptTemplate.prompt_type == prompt_type,
        PromptTemplate.is_active.is_(True),
    ).update({"is_active": False, "updated_at": timestamp})

    prompt = PromptTemplate(
        prompt_type=prompt_type,
        name=name or f"{prompt_type}-v{version}",
        template_text=template_text,
        variables=variables,
        version=version,
        is_active=True,
        created_by=actor_id,
        created_at=timestamp,
        updated_at=timestamp,
    )
    db.add(prompt)
    db.commit()
    db.refresh(prompt)

    clear_prompt_cache(prompt_type)
    default_text, _source = _get_default_prompt(prompt_type)
    return _prompt_from_db(prompt, default_text)


def render_prompt_text(prompt_type: PromptType, variables: dict[str, Any] | None = None) -> str:
    template = get_prompt_template(prompt_type)
    return render_prompt(template["template_text"], variables)


def template_fingerprint(template_text: str) -> str:
    return hashlib.sha256(template_text.encode("utf-8")).hexdigest()
