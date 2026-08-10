"""Speech-to-text transcription of dictated findings.

Holds the business logic that previously lived inline in the
``/api/v1/reports/asr-transcript`` route handler: the upload-size gate, the
transcription call, and the audit-plus-timestamp write-back onto the owning
report. HTTP concerns (``UploadFile`` handling, the WebSocket broadcast) stay
in ``app.api.reports``.
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
from .exceptions import UpstreamError, ValidationError

DEFAULT_MAX_AUDIO_SIZE = 25 * 1024 * 1024


def max_audio_size() -> int:
    """Upload ceiling, read per call so a deployment can change it without a restart."""
    return int(os.environ.get("ASR_MAX_FILE_SIZE", str(DEFAULT_MAX_AUDIO_SIZE)))


@dataclass(frozen=True)
class TranscriptResult:
    """A transcript plus what the caller needs to report on it.

    ``persisted`` and ``qa_status`` exist for the route handler's WebSocket
    broadcast: a transcription without a ``report_id`` — or naming a report
    that does not exist — touches no report, and there is then nothing to
    broadcast about.
    """

    text: str
    confidence: float
    timestamp: datetime
    persisted: bool
    qa_status: str | None


class ASRService:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def check_size(content: bytes) -> None:
        """Reject an empty or oversized payload.

        The caller is expected to have read at most ``max_audio_size() + 1``
        bytes, so an oversized file is detected from that one extra byte
        without ever buffering the whole thing.
        """
        limit = max_audio_size()
        if not content:
            raise ValidationError("Empty audio payload")
        if len(content) > limit:
            raise ValidationError(
                f"Audio file too large (max {limit // (1024 * 1024)} MB)",
                status_code=413,
            )

    async def transcribe(
        self,
        content: bytes,
        *,
        filename: str,
        content_type: str | None,
        language: str | None,
        report_id: str | None,
    ) -> TranscriptResult:
        """Transcribe the audio and, when a report is named, record it.

        The transcript is returned either way. A ``report_id`` naming a report
        that does not exist is not an error: the audit event is still written
        against that id, which is the behaviour this endpoint has always had —
        a dictation is worth recording even when its report has gone.
        """
        self.check_size(content)

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
            return TranscriptResult(
                text=text,
                confidence=confidence,
                timestamp=timestamp,
                persisted=False,
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
                text=text,
                confidence=confidence,
                model_name=model_name,
                language=language,
                content=content,
                metadata=metadata,
            ),
            timestamp=timestamp,
            source="api",
        )
        self.db.commit()

        return TranscriptResult(
            text=text,
            confidence=confidence,
            timestamp=timestamp,
            persisted=True,
            qa_status=report.qa_status if report else "pending",
        )

    @staticmethod
    def _audit_metadata(
        *,
        text: str,
        confidence: float,
        model_name: str,
        language: str | None,
        content: bytes,
        metadata: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Assemble the provenance recorded with the audit event.

        The provider's own metadata is merged last so a field it reports wins
        over the defaults.
        """
        payload: dict[str, Any] = {
            "confidence": confidence,
            "transcript_length": len(text),
            "model_version": model_name,
            "input_hash": compute_bytes_hash(content),
            "output_summary": f"transcript_length={len(text)}",
            "asr_language_requested": language,
        }
        if metadata:
            payload.update(metadata)
        return payload
