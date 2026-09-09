"""Longitudinal comparison behind ``POST /api/v1/inference/comparison``.

Current versus prior series, both rendered via the segmenter.
"""

from __future__ import annotations

from ...schemas import ComparisonInferenceRequest
from ...tasks import run_comparison_inference_job
from ...utils.hashing import compute_text_hash
from ._common import JobSpec, QueueContext


def build_comparison_job(ctx: QueueContext, payload: ComparisonInferenceRequest) -> JobSpec:
    findings_text = ctx.findings_text(payload.findings_text)

    # The pair of series plus the interval between them is what identifies a
    # comparison, and it is what the audit trail and the job row record.
    # The rendering parameters below feed the hash but not the metadata --
    # unlike the volume route, which records them.
    pair = {
        "study_uid": payload.study_uid,
        "series_uid": payload.series_uid,
        "prior_study_uid": payload.prior_study_uid,
        "prior_series_uid": payload.prior_series_uid,
        "time_delta_days": payload.time_delta_days,
    }

    return JobSpec(
        task_fn=run_comparison_inference_job,
        input_hash=compute_text_hash(
            "comparison",
            ctx.study_id,
            payload.study_uid,
            payload.series_uid,
            payload.prior_study_uid,
            payload.prior_series_uid,
            str(payload.time_delta_days or ""),
            payload.window_preset,
            str(payload.max_slices or ""),
            findings_text,
        ),
        audit_event_type="inference_comparison_queued",
        payload={
            **pair,
            "findings_text": findings_text,
            "max_slices": payload.max_slices,
            "window_preset": payload.window_preset,
        },
        job_metadata={"job_type": "comparison_inference", **pair},
        audit_metadata={"job_type": "comparison_inference", **pair},
    )
