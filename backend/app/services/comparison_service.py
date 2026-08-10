"""Current-study ↔ prior-study pairings for longitudinal context.

Holds the business logic that previously lived inline in the
``/api/v1/reports/{report_id}/comparisons`` route handlers. HTTP concerns
(status-code translation) stay in ``app.api.reports``.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import Report, ReportComparison
from ..schemas import ReportComparisonCreateRequest, ReportComparisonResponse
from ..utils.time import utc_now
from .exceptions import NotFoundError


class ComparisonService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------
    @staticmethod
    def serialize(comparison: ReportComparison) -> ReportComparisonResponse:
        return ReportComparisonResponse(
            id=comparison.id,
            current_report_id=comparison.current_report_id,
            prior_study_uid=comparison.prior_study_uid,
            prior_series_uid=comparison.prior_series_uid,
            time_delta_days=comparison.time_delta_days,
            created_at=comparison.created_at,
        )

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------
    def list_for_report(self, report_id: str) -> list[ReportComparison]:
        """Newest first.

        Deliberately does not check that the report exists: an unknown id has no
        comparisons, which an empty list already says.
        """
        return (
            self.db.query(ReportComparison)
            .filter(ReportComparison.current_report_id == report_id)
            .order_by(ReportComparison.created_at.desc())
            .all()
        )

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------
    def create(self, report_id: str, payload: ReportComparisonCreateRequest) -> ReportComparison:
        """Pair a prior study with an existing report.

        Unlike listing, this checks the report: a comparison hanging off an id
        that names nothing would never be read back.
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
