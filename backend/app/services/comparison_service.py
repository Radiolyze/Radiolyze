"""Prior-study comparisons attached to a report.

Holds the business logic that previously lived inline in the
``/api/v1/reports/{report_id}/comparisons`` route handlers: verifying the
report exists, recording which prior study it was read against, and listing
those comparisons newest-first. HTTP concerns stay in ``app.api.reports``.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import Report, ReportComparison
from ..schemas import ReportComparisonCreateRequest
from ..utils.time import utc_now
from .exceptions import NotFoundError


class ComparisonService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, report_id: str, payload: ReportComparisonCreateRequest) -> ReportComparison:
        """Record that this report was read against a prior study.

        The report is checked first so a comparison can never be orphaned from
        the report it belongs to.
        """
        if not self.db.get(Report, report_id):
            raise NotFoundError("Report not found")

        comparison = ReportComparison(
            current_report_id=report_id,
            prior_study_uid=payload.prior_study_uid,
            prior_series_uid=payload.prior_series_uid,
            time_delta_days=payload.time_delta_days,
            created_at=utc_now(),
        )
        self.db.add(comparison)
        self.db.commit()
        self.db.refresh(comparison)
        return comparison

    def list_for_report(self, report_id: str) -> list[ReportComparison]:
        """Comparisons on a report, newest first.

        Deliberately does not verify the report exists: an unknown id yields an
        empty list rather than a 404, which is the behaviour this endpoint has
        always had.
        """
        return (
            self.db.query(ReportComparison)
            .filter(ReportComparison.current_report_id == report_id)
            .order_by(ReportComparison.created_at.desc())
            .all()
        )
