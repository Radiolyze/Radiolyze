"""Structured-report and PDF export.

Holds the business logic that previously lived inline in the
``/api/v1/reports/{report_id}/export-sr`` and ``/export-pdf`` route handlers:
resolving who gets recorded as the exporting actor, building the artifact,
archiving a DICOM SR to Orthanc, and writing the ``report_exported`` audit
event. HTTP concerns (the ``Response`` and its ``Content-Disposition`` header,
status-code translation) stay in ``app.api.reports``.

The two exports look different but share their whole frame: the same report
lookup, the same actor resolution, and the same audit event differing only in
metadata. That commonality is the reason they sit in one service.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..dicom_client import store_sr
from ..models import Report
from ..sr import build_sr_export
from .exceptions import NotFoundError, ValidationError

logger = logging.getLogger(__name__)

SR_FORMATS = frozenset({"json", "dicom"})


class UnsupportedExportError(ValidationError):
    """Raised when the requested export is not available on this deployment.

    Separate from a plain ``ValidationError``: the request is well-formed and
    the server simply cannot fulfil it, which is a 501 rather than a 400.
    """

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=501)


@dataclass(frozen=True)
class ExportResult:
    """A rendered export plus what the route needs to serve it."""

    content: bytes | str
    filename: str
    media_type: str


class ExportService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Shared frame
    # ------------------------------------------------------------------
    def _load_report(self, report_id: str) -> Report:
        report = self.db.get(Report, report_id)
        if not report:
            raise NotFoundError("Report not found")
        return report

    @staticmethod
    def resolve_actor(
        report: Report,
        *,
        current_user_id: str | None,
        actor_id: str | None,
    ) -> str | None:
        """Who the audit trail records as having exported the report.

        The authenticated caller wins over the ``actor_id`` query parameter,
        which is client-controlled and remains only as a dev-mode/back-compat
        fallback. Falling back to ``approved_by`` keeps an export attributable
        when neither is supplied.
        """
        if current_user_id is not None:
            return current_user_id
        return actor_id or report.approved_by

    def _record_export(
        self,
        report: Report,
        *,
        actor_id: str | None,
        metadata: dict[str, object],
    ) -> None:
        add_audit_event(
            self.db,
            event_type="report_exported",
            actor_id=actor_id,
            report_id=report.id,
            study_id=report.study_id,
            metadata=metadata,
            source="api",
        )
        self.db.commit()

    # ------------------------------------------------------------------
    # Structured report
    # ------------------------------------------------------------------
    def export_structured_report(
        self,
        report_id: str,
        *,
        export_format: str,
        current_user_id: str | None,
        actor_id: str | None,
    ) -> ExportResult:
        """Render the report as a structured report and record the export.

        A DICOM SR is additionally archived to Orthanc via STOW-RS. That
        archival is deliberately non-fatal: the radiologist asked for a file,
        and an unreachable PACS is no reason to withhold one that was built
        successfully. The failure is logged and the audit event records a null
        ``orthanc_url``, which is what distinguishes an unarchived export from
        an archived one after the fact.
        """
        report = self._load_report(report_id)
        audit_actor_id = self.resolve_actor(
            report, current_user_id=current_user_id, actor_id=actor_id
        )

        normalized = export_format.lower()
        if normalized not in SR_FORMATS:
            raise ValidationError("Unsupported SR export format")

        content, filename, media_type = build_sr_export(report, normalized)

        orthanc_url: str | None = None
        if normalized == "dicom" and isinstance(content, (bytes, bytearray)):
            try:
                orthanc_url = store_sr(report.study_id, bytes(content))
                report.dicom_sr_orthanc_url = orthanc_url
            except RuntimeError as exc:
                logger.warning("STOW-RS archival failed (non-fatal): %s", exc)

        self._record_export(
            report,
            actor_id=audit_actor_id,
            metadata={
                "format": normalized,
                "file_name": filename,
                "orthanc_url": orthanc_url,
            },
        )

        return ExportResult(content=content, filename=filename, media_type=media_type)

    # ------------------------------------------------------------------
    # PDF
    # ------------------------------------------------------------------
    def export_pdf(
        self,
        report_id: str,
        *,
        current_user_id: str | None,
        actor_id: str | None,
    ) -> ExportResult:
        """Render the report as a PDF and record the export.

        ``build_pdf_export`` raises ``RuntimeError`` when the optional PDF
        toolchain is not installed; that is a missing capability rather than a
        bad request, so it surfaces as an ``UnsupportedExportError`` the route
        turns into a 501.
        """
        report = self._load_report(report_id)
        audit_actor_id = self.resolve_actor(
            report, current_user_id=current_user_id, actor_id=actor_id
        )

        # Imported lazily: the PDF toolchain is optional, and importing it at
        # module scope would make this service unimportable without it.
        from ..pdf_export import build_pdf_export

        try:
            pdf_bytes, filename = build_pdf_export(report)
        except RuntimeError as exc:
            raise UnsupportedExportError(str(exc)) from exc

        self._record_export(
            report,
            actor_id=audit_actor_id,
            metadata={"format": "pdf", "file_name": filename},
        )

        return ExportResult(
            content=pdf_bytes,
            filename=filename,
            media_type="application/pdf",
        )
