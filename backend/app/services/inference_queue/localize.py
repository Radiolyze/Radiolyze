"""On-demand single-frame localization behind ``POST /api/v1/inference/localize``.

The only queue route with a clinical precondition: localization is validated
for chest radiographs only.
"""

from __future__ import annotations

from fastapi import HTTPException

from ...audit import add_audit_event
from ...inference_clients import CXR_MODALITIES
from ...schemas import LocalizeRequest
from ...tasks import run_localize_job
from ...utils.hashing import compute_localize_hash
from ._common import JobSpec, QueueContext

_DEFAULT_MODE = "cxr_finding"


def build_localize_job(ctx: QueueContext, payload: LocalizeRequest) -> JobSpec:
    image_ref = payload.image_ref.model_dump()
    mode = payload.mode or _DEFAULT_MODE

    # The same allow-list the generation side enforces (it raises
    # UnsupportedModalityError). Shared rather than restated so the two cannot
    # drift into accepting a job here that the worker then refuses.
    modality_value = payload.image_ref.series_modality or ""
    if modality_value and modality_value.upper() not in CXR_MODALITIES:
        # Audited before the raise: a rejected request is still a request a
        # clinician made, and the commit is what makes the 422 auditable.
        add_audit_event(
            ctx.db,
            event_type="inference_localize_rejected_modality",
            actor_id=ctx.requested_by,
            report_id=ctx.report_id,
            study_id=ctx.study_id,
            metadata={
                "modality": modality_value,
                "mode": mode,
                "image_ref": image_ref,
            },
            source="api",
        )
        ctx.db.commit()
        raise HTTPException(
            status_code=422,
            detail=(
                "Localization is only validated for chest radiographs (CR/DX); "
                f"got modality={modality_value!r}"
            ),
        )

    return JobSpec(
        task_fn=run_localize_job,
        input_hash=compute_localize_hash(ctx.study_id, {**image_ref, "mode": mode}),
        audit_event_type="inference_queued",
        payload={"image_ref": image_ref, "mode": mode},
        job_metadata={"image_ref": image_ref, "job_type": "localize"},
        audit_metadata={"job_type": "localize", "image_ref": image_ref},
    )
