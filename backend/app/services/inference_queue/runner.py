"""The shared skeleton behind every inference queue route.

Each route was 110 lines of which roughly 90 were the same nine steps: resolve
the report, default the requester and study, hash the input, assemble the
payload, open a span, enqueue, build the response, and broadcast the new status
once the synchronous work is off the event loop. Only the middle two steps
differ per job type, and those are the `build` callback.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from ...schemas import InferenceQueueResponse
from ...tracing import get_tracer
from ...ws_manager import broadcast_status
from ..inference_service import InferenceService
from ._common import JobSpec, QueueContext, QueuePayload

PayloadT = TypeVar("PayloadT", bound=QueuePayload)

# The instrumentation scope these spans have always carried. It is pinned to
# the route module rather than taken from ``__name__`` on purpose: the scope
# name is exported with every span, so deriving it from wherever the code
# happens to live would silently rename it in traces and dashboards whenever
# the code moves -- which is exactly what this refactor does.
_TRACER_NAME = "app.api.inference"


def _enqueue(
    db: Session,
    payload: PayloadT,
    build: Callable[[QueueContext, PayloadT], JobSpec],
    span_name: str,
) -> tuple[InferenceQueueResponse, str]:
    """The synchronous half, run in a worker thread.

    Everything that touches the DB session happens here, including the guards
    inside ``build`` that reject a request (404/400/422) before anything is
    enqueued.
    """
    ctx = QueueContext.resolve(db, payload)
    spec = build(ctx, payload)

    service = InferenceService(db)
    with get_tracer(_TRACER_NAME).start_as_current_span(span_name) as span:
        span.set_attribute("radiolyze.job_id", ctx.job_id)
        span.set_attribute("radiolyze.report_id", str(ctx.report_id))
        span.set_attribute("radiolyze.study_id", str(ctx.study_id))
        span.set_attribute("radiolyze.model", ctx.model_version)
        job = service.enqueue(
            spec.task_fn,
            {
                "job_id": ctx.job_id,
                "report_id": ctx.report_id,
                "study_id": ctx.study_id,
                "requested_by": ctx.requested_by,
                "model_version": ctx.model_version,
                "input_hash": spec.input_hash,
                **spec.payload,
            },
            job_id=ctx.job_id,
            report=ctx.report,
            report_id=ctx.report_id,
            study_id=ctx.study_id,
            requested_by=ctx.requested_by,
            model_version=ctx.model_version,
            input_hash=spec.input_hash,
            queued_at=ctx.queued_at,
            job_metadata={"requested_by": ctx.requested_by, **spec.job_metadata},
            audit_event_type=spec.audit_event_type,
            audit_metadata={
                "job_id": ctx.job_id,
                "model_version": ctx.model_version,
                "input_hash": spec.input_hash,
                **spec.audit_metadata,
            },
        )

    response = service.build_response(
        job,
        queued_at=ctx.queued_at,
        report_id=ctx.report_id,
        study_id=ctx.study_id,
        model_version=ctx.model_version,
    )
    return response, ctx.qa_status


async def queue_and_broadcast(
    db: Session,
    payload: PayloadT,
    *,
    span_name: str,
    build: Callable[[QueueContext, PayloadT], JobSpec],
) -> InferenceQueueResponse:
    """Enqueue one inference job and tell the report's watchers about it.

    The broadcast deliberately stays outside the threadpool hop: it is async,
    and it must not run for a request that raised on the way in.
    """
    response, qa_status = await run_in_threadpool(_enqueue, db, payload, build, span_name)

    if payload.report_id:
        await broadcast_status(
            payload.report_id,
            {
                "aiStatus": "queued",
                "qaStatus": qa_status,
                "asrStatus": "idle",
            },
        )

    return response
