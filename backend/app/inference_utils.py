"""Low-level primitives shared across the inference client modules.

Env parsing, value coercion and small formatting helpers used by
``image_encoder``, ``schema_validator``, ``vllm_client`` and the
``inference_clients`` orchestrator.
"""

from __future__ import annotations

import os
import re
from typing import Any

_CRED_RE = re.compile(r"(https?://)([^:]+:[^@]+)@")


def _redact_url(url: str) -> str:
    """Replace embedded user:pass in URLs with ***:***."""
    return _CRED_RE.sub(r"\1***:***@", url)


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _schema_strict() -> bool:
    return _env_flag("VLLM_SCHEMA_STRICT", False)


def _compact_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in metadata.items() if value is not None}


def _normalize_list(values: list[str] | None) -> list[str]:
    if not values:
        return []
    return [value.strip() for value in values if isinstance(value, str) and value.strip()]


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _as_int(value: Any) -> int | None:
    parsed = _as_float(value)
    if parsed is None or not parsed.is_integer():
        return None
    return int(parsed)


def _format_float(value: float) -> str:
    return f"{value:.4f}".rstrip("0").rstrip(".")


def _normalize_float_list(raw: Any) -> list[float] | None:
    if not isinstance(raw, list):
        return None
    values: list[float] = []
    for entry in raw:
        parsed = _as_float(entry)
        if parsed is None:
            continue
        values.append(parsed)
    return values or None
