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


def compute_text_hash(*values: str | None) -> str:
    normalized = [value.strip() for value in values if value and value.strip()]
    raw = "|".join(normalized)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_bytes_hash(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()
