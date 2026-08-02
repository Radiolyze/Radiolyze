from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any

from .time import ensure_utc


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


def compute_audit_event_hash(
    *,
    seq: int,
    prev_hash: str | None,
    event_type: str,
    actor_id: str | None,
    report_id: str | None,
    study_id: str | None,
    timestamp: datetime | str,
    metadata: dict[str, Any] | None,
) -> str:
    """Hash-chain link for one audit event, binding it to its predecessor.

    Any later change to a stored row (including its ``prev_hash``/``event_hash``
    themselves) makes this no longer reproduce the stored ``event_hash``, which
    is how ``app.audit.verify_audit_chain`` detects tampering.

    ``timestamp`` is canonicalised as ``ensure_utc(...).isoformat()``, which is
    exactly the string the column used to hold back when it was a ``String``
    (every writer went through ``utc_now()``, so every value carried a
    ``+00:00`` offset). That is what lets events written before the
    ``timestamptz`` migration keep verifying afterwards — the migration
    changes the storage type, not the hashed bytes. A ``str`` is still
    accepted and hashed verbatim so a caller holding a raw stored value can
    reproduce a hash without a parse step.
    """
    canonical = json.dumps(
        {
            "seq": seq,
            "prev_hash": prev_hash,
            "event_type": event_type,
            "actor_id": actor_id,
            "report_id": report_id,
            "study_id": study_id,
            "timestamp": timestamp
            if isinstance(timestamp, str)
            else ensure_utc(timestamp).isoformat(),
            "metadata": metadata or {},
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
