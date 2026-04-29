from __future__ import annotations

import hashlib
import json
from typing import Any


def compute_input_hash(
    study_id: str | None,
    findings_text: str | None,
    image_urls: list[str] | None = None,
    image_paths: list[str] | None = None,
    image_refs: list[dict[str, Any]] | None = None,
) -> str:
    normalized_urls = [url.strip() for url in (image_urls or []) if url and url.strip()]
    normalized_paths = [path.strip() for path in (image_paths or []) if path and path.strip()]
    normalized_refs = json.dumps(image_refs or [], sort_keys=True)
    raw = "|".join(
        [
            study_id or "",
            (findings_text or "").strip(),
            ",".join(normalized_urls),
            ",".join(normalized_paths),
            normalized_refs,
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_localize_hash(study_id: str | None, image_ref: dict[str, Any] | None) -> str:
    """Hash for single-frame localization input."""
    ref_str = json.dumps(image_ref or {}, sort_keys=True)
    raw = f"localize|{study_id or ''}|{ref_str}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_volume_hash(
    study_id: str | None,
    *,
    study_uid: str,
    series_uid: str,
    findings_text: str | None,
    max_slices: int | None,
    window_preset: str | None,
    strategy: str | None,
) -> str:
    """Hash for volume-based inference input (P0.B)."""
    raw = "|".join(
        [
            "volume",
            study_id or "",
            study_uid,
            series_uid,
            (findings_text or "").strip(),
            str(max_slices or ""),
            window_preset or "",
            strategy or "",
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_text_hash(*values: str | None) -> str:
    normalized = [value.strip() for value in values if value and value.strip()]
    raw = "|".join(normalized)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_bytes_hash(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()
