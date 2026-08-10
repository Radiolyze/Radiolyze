"""Speech-to-text transcription of dictated audio.

Holds the business logic that previously lived inline in the
``/api/v1/reports/asr-transcript`` route handler: the accepted-payload bounds,
the provider call, and the audit trail written when the transcript belongs to a
report. HTTP concerns (reading the upload, status-code translation and the
WebSocket broadcast) stay in ``app.api.reports``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..inference_clients import transcribe_audio
from ..models import Report
from ..utils.hashing import compute_bytes_hash
from ..utils.time import utc_now
from .exceptions import PayloadTooLargeError, UpstreamError, ValidationError

DEFAULT_MAX_AUDIO_BYTES = 25 * 1024 * 1024


@dataclass(frozen=True)
class TranscriptionResult:
    """A transcript plus what the caller needs to report on it.

    ``recorded`` and ``qa_status`` exist for the route handler's WebSocket
    broadcast: a transcript that names no report is returned without touching
    any state, and there is then nothing to broadcast about. ``qa_status`` is
    ``None`` when no report row was found, which is not the same as a report
    whose QA is pending.
    """

    text: str
    confidence: float
    timestamp: datetime
    recorded: bool
    qa_status: str | None


class TranscriptionService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Payload bounds
    # ------------------------------------------------------------------
    @staticmethod
    def max_audio_bytes() -> int:
        """The largest audio upload this deployment accepts."""
        return int(os.environ.get("ASR_MAX_FILE_SIZE", str(DEFAULT_MAX_AUDIO_BYTES)))

    @classmethod
    def validate_payload(cls, content: bytes) -> None:
        max_bytes = cls.max_audio_bytes()
        if not content:
            raise ValidationError("Empty audio payload")
        if len(content) > max_bytes:
            raise PayloadTooLargeError(
                f"Audio file too large (max {max_bytes // (1024 * 1024)} MB)"
            )

    # ------------------------------------------------------------------
    # Transcribe + record
    # ------------------------------------------------------------------
    async def transcribe(
        self,
        *,
        content: bytes,
        filename: str,
        content_type: str | None = None,
        language: str | None = None,
        report_id: str | None = None,
    ) -> TranscriptionResult:
        """Transcribe audio and, when a report is named, record the attempt.

        The audit event is written for any ``report_id`` the caller supplies,
        including one that matches no row — the transcription happened and is
        worth recording either way, and the event simply carries no ``study_id``
        in that case. Only an existing report has its ``updated_at`` touched.
        """
        self.validate_payload(content)

        try:
            text, confidence, model_name, metadata = await transcribe_audio(
                content=content,
                filename=filename,
                content_type=content_type,
                language=language,
            )
        except RuntimeError as exc:
            raise UpstreamError(str(exc)) from exc

        timestamp = utc_now()

        if not report_id:
            return TranscriptionResult(
                text=text,
                confidence=confidence,
                timestamp=timestamp,
                recorded=False,
                qa_status=None,
            )

        report = self.db.get(Report, report_id)
        if report:
            report.updated_at = timestamp

        add_audit_event(
            self.db,
            event_type="asr_transcription",
            actor_id=None,
            report_id=report_id,
            study_id=report.study_id if report else None,
            metadata=self._audit_metadata(
                content=content,
                text=text,
                confidence=confidence,
                model_name=model_name,
                language=language,
                metadata=metadata,
            ),
            timestamp=timestamp,
            source="api",
        )
        self.db.commit()

        return TranscriptionResult(
            text=text,
            confidence=confidence,
            timestamp=timestamp,
            recorded=True,
            qa_status=report.qa_status if report else None,
        )

    @staticmethod
    def _audit_metadata(
        *,
        content: bytes,
        text: str,
        confidence: float,
        model_name: str,
        language: str | None,
        metadata: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Assemble the provenance recorded with the audit event.

        The audio itself is never stored, so its hash is what ties a transcript
        back to the recording it came from. The provider's own metadata is
        merged last, so a more precise value it reports wins over the defaults.
        """
        audit_metadata: dict[str, Any] = {
            "confidence": confidence,
            "transcript_length": len(text),
            "model_version": model_name,
            "input_hash": compute_bytes_hash(content),
            "output_summary": f"transcript_length={len(text)}",
            "asr_language_requested": language,
        }
        if metadata:
            audit_metadata.update(metadata)
        return audit_metadata
