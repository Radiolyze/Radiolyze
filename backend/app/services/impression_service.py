"""Synchronous impression generation.

Holds the business logic that previously lived inline in the
``/api/v1/reports/generate-impression`` and ``/stream-impression`` route
handlers: the model call, the audit-metadata assembly and the write-back onto
the owning report. HTTP concerns (status-code translation, SSE framing, the
WebSocket broadcast) stay in ``app.api.reports``.

Deliberately separate from ``InferenceService``: that one enqueues RQ jobs for
the asynchronous pipeline and polls them, whereas this path calls the model
inline and returns the text in the response.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..inference_clients import generate_impression_stream, generate_impression_text
from ..models import Report
from ..schemas import ImpressionRequest
from ..utils.hashing import compute_input_hash
from ..utils.inference import build_image_metadata, build_output_summary
from ..utils.time import utc_now
from .exceptions import NotFoundError, UpstreamError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ImpressionResult:
    """A generated impression plus what the caller needs to report on it.

    ``persisted`` and ``qa_status`` exist for the route handler's WebSocket
    broadcast: a request without a ``report_id`` generates text without
    touching any report, and there is then nothing to broadcast about.
    """

    text: str
    confidence: float
    model: str
    generated_at: datetime
    metadata: dict[str, Any] | None
    persisted: bool
    qa_status: str | None


class ImpressionService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Model calls
    # ------------------------------------------------------------------
    @staticmethod
    async def _call_model(
        payload: ImpressionRequest,
    ) -> tuple[str, float, str, dict[str, Any] | None]:
        """Run the blocking model call off the event loop.

        ``generate_impression_text`` raises ``RuntimeError`` when the model
        server is unreachable; that becomes an ``UpstreamError`` so the service
        stays free of HTTP status codes.
        """
        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(
                None,
                lambda: generate_impression_text(
                    payload.findings_text,
                    image_urls=payload.image_urls,
                    image_paths=payload.image_paths,
                ),
            )
        except RuntimeError as exc:
            raise UpstreamError(str(exc)) from exc

    @staticmethod
    async def stream(payload: ImpressionRequest) -> AsyncIterator[str]:
        """Yield impression tokens, ending the stream on an upstream failure.

        A mid-stream error cannot become a status code — the response headers
        are long gone — so it is logged and the iterator simply ends. The
        caller is responsible for the SSE framing and terminator.
        """
        try:
            async for token in generate_impression_stream(
                payload.findings_text,
                image_urls=payload.image_urls,
                image_refs=getattr(payload, "image_refs", None),
            ):
                yield token
        except Exception as exc:  # the stream must not propagate a failure
            logger.error("Impression stream error: %s", exc)

    # ------------------------------------------------------------------
    # Generate + persist
    # ------------------------------------------------------------------
    async def generate(self, payload: ImpressionRequest) -> ImpressionResult:
        """Generate an impression and, when a report is named, persist it.

        Raises ``NotFoundError`` if the named report does not exist — the text
        has already been generated at that point and is deliberately not
        returned, matching the pre-existing behaviour of the route.
        """
        text, confidence, model_name, metadata = await self._call_model(payload)
        generated_at = utc_now()

        if not payload.report_id:
            return ImpressionResult(
                text=text,
                confidence=confidence,
                model=model_name,
                generated_at=generated_at,
                metadata=metadata,
                persisted=False,
                qa_status=None,
            )

        report = self.db.get(Report, payload.report_id)
        if not report:
            raise NotFoundError(
                f"Report {payload.report_id} not found; impression was generated but not persisted"
            )

        report.impression_text = text
        report.updated_at = generated_at
        if report.status in {"pending", "in_progress"}:
            report.status = "draft"

        add_audit_event(
            self.db,
            event_type="impression_generated",
            actor_id="system",
            report_id=payload.report_id,
            study_id=report.study_id,
            metadata=self._audit_metadata(
                payload,
                report=report,
                text=text,
                confidence=confidence,
                model_name=model_name,
                metadata=metadata,
            ),
            timestamp=generated_at,
            source="api",
        )
        self.db.commit()

        return ImpressionResult(
            text=text,
            confidence=confidence,
            model=model_name,
            generated_at=generated_at,
            metadata=metadata,
            persisted=True,
            qa_status=report.qa_status,
        )

    @staticmethod
    def _audit_metadata(
        payload: ImpressionRequest,
        *,
        report: Report,
        text: str,
        confidence: float,
        model_name: str,
        metadata: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Assemble the provenance recorded with the audit event.

        The model's own metadata is merged last so a client-visible field it
        reports (e.g. a more precise model version) wins over the defaults.
        """
        audit_metadata: dict[str, Any] = {
            "model_version": model_name,
            "model": model_name,
            "confidence": confidence,
            "pipeline": "impression_service",
            "input_hash": compute_input_hash(
                report.study_id,
                payload.findings_text,
                payload.image_urls,
                payload.image_paths,
            ),
            "output_summary": build_output_summary(text),
            **build_image_metadata(payload.image_urls, payload.image_paths, None),
        }
        if metadata:
            audit_metadata.update(metadata)
        return audit_metadata
