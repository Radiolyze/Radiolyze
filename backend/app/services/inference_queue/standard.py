"""The general-purpose inference job behind ``POST /api/v1/inference/queue``.

The only route that accepts free-form image inputs, and therefore the only one
carrying the path allow-list.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import HTTPException

from ...schemas import InferenceQueueRequest
from ...tasks import run_inference_job
from ...utils.hashing import compute_input_hash
from ...utils.inference import build_image_metadata
from ._common import JobSpec, QueueContext

# Allowed base directories for image_paths (prevents path traversal)
_ALLOWED_IMAGE_DIRS = [
    os.getenv("IMAGE_STORAGE_DIR", "/data/images"),
    "/tmp/dicom",
]


def _validate_image_paths(paths: list[str]) -> list[str]:
    """Reject paths that escape allowed directories (path traversal prevention).

    Returns the *resolved* paths, which is what reaches the worker and the
    input hash -- so two spellings of one file are one request.
    """
    if not paths:
        return []

    validated: list[str] = []
    for raw_path in paths:
        resolved = str(Path(raw_path).resolve())
        if not any(resolved.startswith(allowed) for allowed in _ALLOWED_IMAGE_DIRS):
            raise HTTPException(
                status_code=400,
                detail=f"Image path not in allowed directory: {raw_path}",
            )
        validated.append(resolved)
    return validated


def build_standard_job(ctx: QueueContext, payload: InferenceQueueRequest) -> JobSpec:
    findings_text = ctx.findings_text(payload.findings_text)
    image_urls = payload.image_urls or []
    image_paths = _validate_image_paths(payload.image_paths or [])
    image_refs = [ref.model_dump() for ref in (payload.image_refs or [])]
    if not findings_text and not image_urls and not image_paths and not image_refs:
        raise HTTPException(
            status_code=422,
            detail="At least one of findings_text, image_urls, image_paths, or image_refs is required",
        )

    image_metadata = build_image_metadata(image_urls, image_paths, image_refs)

    return JobSpec(
        task_fn=run_inference_job,
        input_hash=compute_input_hash(
            ctx.study_id, findings_text, image_urls, image_paths, image_refs
        ),
        audit_event_type="inference_queued",
        payload={
            "findings_text": findings_text,
            "image_urls": image_urls,
            "image_paths": image_paths,
            "image_refs": image_refs,
        },
        job_metadata={"image_refs": image_refs, **image_metadata},
        audit_metadata={"image_refs": image_refs, **image_metadata},
    )
