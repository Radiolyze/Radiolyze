"""Peer review / second-opinion request and submission logic.

Holds the business logic that previously lived inline in the
``/api/v1/reports/{report_id}/request-review``, ``reviews`` and
``reviews/{review_id}/submit`` route handlers. HTTP concerns (status-code
translation, WebSocket broadcasts) remain in ``app.api.reports``.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..models import PeerReview, Report
from ..schemas import PeerReviewRequest, PeerReviewResponse, PeerReviewSubmitRequest
from ..utils.time import utc_now
from .exceptions import ConflictError, NotFoundError


class PeerReviewService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------
    @staticmethod
    def serialize(review: PeerReview) -> PeerReviewResponse:
        return PeerReviewResponse(
            id=review.id,
            report_id=review.report_id,
            requested_by=review.requested_by,
            assigned_to=review.assigned_to,
            comment=review.comment,
            review_comment=review.review_comment,
            status=review.status,
            decision=review.decision,
            created_at=review.created_at,
            completed_at=review.completed_at,
        )

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------
    def list_for_report(self, report_id: str) -> list[PeerReview]:
        return (
            self.db.query(PeerReview)
            .filter(PeerReview.report_id == report_id)
            .order_by(PeerReview.created_at.desc())
            .all()
        )

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------
    def request(
        self,
        report_id: str,
        payload: PeerReviewRequest,
        *,
        requested_by: str = "system",
    ) -> PeerReview:
        report = self.db.get(Report, report_id)
        if not report:
            raise NotFoundError(f"Report {report_id} not found")

        now = utc_now()
        review = PeerReview(
            report_id=report_id,
            requested_by=requested_by,
            assigned_to=payload.assigned_to,
            comment=payload.comment,
            status="requested",
            created_at=now,
        )
        self.db.add(review)
        add_audit_event(
            self.db,
            event_type="peer_review_requested",
            actor_id=requested_by,
            report_id=report_id,
            study_id=report.study_id,
            metadata={
                "assigned_to": payload.assigned_to,
                "comment": payload.comment,
            },
            timestamp=now,
            source="api",
        )
        self.db.commit()
        self.db.refresh(review)
        return review

    def submit(
        self, report_id: str, review_id: str, payload: PeerReviewSubmitRequest
    ) -> PeerReview:
        """Record a reviewer's decision once; a second submission is a conflict."""
        review = self.db.get(PeerReview, review_id)
        if not review or review.report_id != report_id:
            raise NotFoundError(f"Review {review_id} not found")
        if review.status == "completed":
            raise ConflictError("Review already completed")

        now = utc_now()
        review.review_comment = payload.review_comment
        review.decision = payload.decision
        review.status = "completed"
        review.completed_at = now

        # The report may have been deleted since the review was requested; the
        # audit event still gets written, just without a study reference.
        report = self.db.get(Report, report_id)
        add_audit_event(
            self.db,
            event_type="peer_review_submitted",
            actor_id=review.assigned_to,
            report_id=report_id,
            study_id=report.study_id if report else None,
            metadata={
                "review_id": review_id,
                "decision": payload.decision,
            },
            timestamp=now,
            source="api",
        )
        self.db.commit()
        return review
