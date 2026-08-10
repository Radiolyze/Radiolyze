"""Structured-report and PDF export.

Holds the business logic that previously lived inline in the
``/api/v1/reports/{report_id}/export-sr`` and ``export-pdf`` route handlers:
resolving who gets recorded as the exporting actor, building the artefact,
archiving a DICOM SR to the PACS, and writing the ``report_exported`` audit
event. HTTP concerns (status-code translation and the ``Content-Disposition``
response framing) stay in ``app.api.reports``.

The two formats share everything except how the bytes are produced, so they
share one audit path here — previously the same event was assembled twice.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..dicom_client import store_sr
from ..models import Report
from ..pdf_export import build_pdf_export
from ..sr import build_sr_export
from .exceptions import FeatureUnavailableError, NotFoundError, ValidationError

logger = logging.getLogger(__name__)

PDF_MEDIA_TYPE = "application/pdf"

# The SR formats ``build_sr_export`` knows how to produce. Anything else is a
# client error rather than a renderer failure, so it is rejected up front.
SUPPORTED_SR_FORMATS = frozenset({"json", "dicom"})


@dataclass(frozen=True)
class ExportArtifact:
    """A rendered export, ready for the route handler to attach to a response."""

    content: bytes
    filename: str
    media_type: str


class ExportService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Exports
    # ------------------------------------------------------------------
    def export_sr(
        self,
        report_id: str,
        export_format: str,
        *,
        current_user_id: str | None = None,
        actor_id: str | None = None,
    ) -> ExportArtifact:
        """Render a structured report as JSON or DICOM SR.

        A ``dicom`` export is additionally archived to Orthanc via STOW-RS. That
        archival is deliberately non-fatal: the caller asked for the bytes, and
        withholding a successfully rendered SR because the PACS is unreachable
        would lose work. The outcome is recorded either way — the audit event
        carries the resulting URL, or ``None`` if the push failed.
        """
        report = self._require_report(report_id)

        normalized = export_format.lower()
        if normalized not in SUPPORTED_SR_FORMATS:
            raise ValidationError("Unsupported SR export format")

        content, filename, media_type = build_sr_export(report, normalized)

        orthanc_url: str | None = None
        if normalized == "dicom" and isinstance(content, (bytes, bytearray)):
            orthanc_url = self._archive_sr(report, bytes(content))

        self._record_export(
            report,
            current_user_id=current_user_id,
            actor_id=actor_id,
            metadata={
                "format": normalized,
                "file_name": filename,
                "orthanc_url": orthanc_url,
            },
        )

        return ExportArtifact(content=content, filename=filename, media_type=media_type)

    def export_pdf(
        self,
        report_id: str,
        *,
        current_user_id: str | None = None,
        actor_id: str | None = None,
    ) -> ExportArtifact:
        """Render a report as a PDF document.

        ``build_pdf_export`` raises ``RuntimeError`` when the optional reportlab
        dependency is missing from the build; that is a capability this
        deployment lacks rather than a bad request or a failing upstream, so it
        surfaces as :class:`FeatureUnavailableError`.
        """
        report = self._require_report(report_id)

        try:
            pdf_bytes, filename = build_pdf_export(report)
        except RuntimeError as exc:
            raise FeatureUnavailableError(str(exc)) from exc

        self._record_export(
            report,
            current_user_id=current_user_id,
            actor_id=actor_id,
            metadata={"format": "pdf", "file_name": filename},
        )

        return ExportArtifact(content=pdf_bytes, filename=filename, media_type=PDF_MEDIA_TYPE)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _require_report(self, report_id: str) -> Report:
        report = self.db.get(Report, report_id)
        if not report:
            raise NotFoundError("Report not found")
        return report

    def _archive_sr(self, report: Report, content: bytes) -> str | None:
        """Push a rendered SR to the PACS, returning its URL or ``None``."""
        try:
            orthanc_url = store_sr(report.study_id, content)
        except RuntimeError as exc:
            logger.warning("STOW-RS archival failed (non-fatal): %s", exc)
            return None
        report.dicom_sr_orthanc_url = orthanc_url
        return orthanc_url

    def _record_export(
        self,
        report: Report,
        *,
        current_user_id: str | None,
        actor_id: str | None,
        metadata: dict[str, Any],
    ) -> None:
        add_audit_event(
            self.db,
            event_type="report_exported",
            actor_id=self.resolve_actor(report, current_user_id=current_user_id, actor_id=actor_id),
            report_id=report.id,
            study_id=report.study_id,
            metadata=metadata,
            source="api",
        )
        self.db.commit()

    @staticmethod
    def resolve_actor(
        report: Report, *, current_user_id: str | None, actor_id: str | None
    ) -> str | None:
        """Decide who the audit trail records as having exported the report.

        An authenticated caller always wins over the ``actor_id`` query
        parameter, which is client-controlled and remains only as a dev-mode
        (``AUTH_REQUIRED=false``) and back-compat fallback. Failing both, the
        report's approver is the best available attribution.
        """
        if current_user_id is not None:
            return current_user_id
        return actor_id or report.approved_by
