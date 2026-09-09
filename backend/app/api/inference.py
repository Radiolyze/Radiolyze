"""Inference HTTP surface.

Routes only: paths, request/response models and the role guard. The queueing
skeleton, the per-job-type payload builders and the status reader live in
``app.services.inference_queue`` (#293).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_db, require_radiologist_or_admin
from ..schemas import (
    ComparisonInferenceRequest,
    InferenceQueueRequest,
    InferenceQueueResponse,
    InferenceStatusResponse,
    LocalizeRequest,
    VolumeInferenceRequest,
)
from ..services.inference_queue import (
    build_comparison_job,
    build_localize_job,
    build_standard_job,
    build_volume_job,
    queue_and_broadcast,
    read_job_status,
)

router = APIRouter()


@router.get("/api/v1/inference/schemas")
def get_inference_schemas() -> dict:
    """Return the JSON Schemas for all AI output types.

    Clients can use these schemas to validate AI responses and display the
    current schema version for EU AI Act audit purposes.
    """
    from ..ai_schemas import get_all_schemas

    return get_all_schemas()


@router.post("/api/v1/inference/queue", response_model=InferenceQueueResponse)
async def queue_inference(
    payload: InferenceQueueRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> InferenceQueueResponse:
    """Queue an inference job over findings text and/or client-supplied images."""
    return await queue_and_broadcast(
        db, payload, span_name="inference.queue", build=build_standard_job
    )


@router.post("/api/v1/inference/localize", response_model=InferenceQueueResponse)
async def queue_localize(
    payload: LocalizeRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> InferenceQueueResponse:
    """Queue on-demand single-frame localization (bounding-box findings)."""
    return await queue_and_broadcast(
        db, payload, span_name="inference.localize", build=build_localize_job
    )


@router.post("/api/v1/inference/volume", response_model=InferenceQueueResponse)
async def queue_volume_inference(
    payload: VolumeInferenceRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> InferenceQueueResponse:
    """Queue a volume-based inference job (P0.B): segmenter preprocess + vLLM."""
    return await queue_and_broadcast(
        db, payload, span_name="inference.volume", build=build_volume_job
    )


@router.post("/api/v1/inference/comparison", response_model=InferenceQueueResponse)
async def queue_comparison_inference(
    payload: ComparisonInferenceRequest,
    _: None = require_radiologist_or_admin,
    db: Session = Depends(get_db),
) -> InferenceQueueResponse:
    """Queue a longitudinal comparison job (P1.A): current vs. prior series."""
    return await queue_and_broadcast(
        db, payload, span_name="inference.comparison", build=build_comparison_job
    )


@router.get("/api/v1/inference/status/{job_id}", response_model=InferenceStatusResponse)
def inference_status(job_id: str, db: Session = Depends(get_db)) -> InferenceStatusResponse:
    """Report a job's state. Deliberately not role-gated: the viewer polls it."""
    return read_job_status(db, job_id)
