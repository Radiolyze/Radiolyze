"""Volume inference behind ``POST /api/v1/inference/volume``.

The segmenter renders a CT/MR series to MedGemma slices, so the job is
identified by the DICOM series rather than by images the client supplies.
"""

from __future__ import annotations

from ...schemas import VolumeInferenceRequest
from ...tasks import run_volume_inference_job
from ...utils.hashing import compute_volume_hash
from ._common import JobSpec, QueueContext


def build_volume_job(ctx: QueueContext, payload: VolumeInferenceRequest) -> JobSpec:
    findings_text = ctx.findings_text(payload.findings_text)

    # The rendering parameters identify the job: the same series windowed or
    # sampled differently is a different inference, so they belong in the hash
    # as well as in the payload.
    series = {
        "study_uid": payload.study_uid,
        "series_uid": payload.series_uid,
        "max_slices": payload.max_slices,
        "window_preset": payload.window_preset,
        "strategy": payload.strategy,
    }

    return JobSpec(
        task_fn=run_volume_inference_job,
        input_hash=compute_volume_hash(
            ctx.study_id,
            study_uid=payload.study_uid,
            series_uid=payload.series_uid,
            findings_text=findings_text,
            max_slices=payload.max_slices,
            window_preset=payload.window_preset,
            strategy=payload.strategy,
        ),
        audit_event_type="inference_volume_queued",
        payload={**series, "findings_text": findings_text},
        job_metadata={"job_type": "volume_inference", **series},
        audit_metadata={"job_type": "volume_inference", **series},
    )
