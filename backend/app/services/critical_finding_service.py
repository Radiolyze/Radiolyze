"""Critical finding detection, alerting and acknowledgement.

Holds the business logic that previously lived inline in the
``/api/v1/reports/{report_id}/check-critical`` and ``critical-alerts`` route
handlers. HTTP concerns (status-code translation, WebSocket broadcasts) remain
in ``app.api.reports``, which delegates the domain work here.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..models import CriticalFindingAlert, QARule, Report
from ..qa_engine import detect_critical_findings
from ..schemas import CriticalFindingAlertResponse
from ..utils.time import utc_now
from .exceptions import ConflictError, NotFoundError


class CriticalFindingService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------
    @staticmethod
    def serialize(alert: CriticalFindingAlert) -> CriticalFindingAlertResponse:
        return CriticalFindingAlertResponse(
            id=alert.id,
            report_id=alert.report_id,
            finding_type=alert.finding_type,
            severity=alert.severity,
            matched_text=alert.matched_text,
            notified_at=alert.notified_at,
            acknowledged_by=alert.acknowledged_by,
            acknowledged_at=alert.acknowledged_at,
        )

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------
    def list_for_report(self, report_id: str) -> list[CriticalFindingAlert]:
        return (
            self.db.query(CriticalFindingAlert)
            .filter(CriticalFindingAlert.report_id == report_id)
            .order_by(CriticalFindingAlert.notified_at.desc())
            .all()
        )

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------
    def detect_and_record(self, report_id: str) -> list[CriticalFindingAlert]:
        """Scan a report against the active QA rules and persist an alert per hit.

        Returns the alerts created by this scan — an empty list when nothing
        matched, which is what tells the caller whether a broadcast is warranted.
        """
        report = self.db.get(Report, report_id)
        if not report:
            raise NotFoundError(f"Report {report_id} not found")

        rules = self.db.query(QARule).filter(QARule.is_active).all()
        detected = detect_critical_findings(report.findings_text, report.impression_text, rules)

        alerts: list[CriticalFindingAlert] = []
        now = utc_now()

        for item in detected:
            alert = CriticalFindingAlert(
                report_id=report_id,
                finding_type=item["finding_type"],
                severity=item["severity"],
                matched_text=item.get("matched_text"),
                notified_at=now,
            )
            self.db.add(alert)
            # Flushed per alert so the generated id is available for the audit
            # event that references it.
            self.db.flush()
            add_audit_event(
                self.db,
                event_type="critical_finding_detected",
                actor_id="system",
                report_id=report_id,
                study_id=report.study_id,
                metadata={
                    "alert_id": alert.id,
                    "finding_type": item["finding_type"],
                    "severity": item["severity"],
                },
                timestamp=now,
                source="api",
            )
            alerts.append(alert)

        self.db.commit()
        return alerts

    def acknowledge(
        self,
        report_id: str,
        alert_id: str,
        *,
        acknowledged_by: str,
        actor_id: str | None = None,
    ) -> CriticalFindingAlert:
        """Acknowledge an alert once; a second attempt is a conflict.

        ``acknowledged_by`` is the client-supplied display name stored on the
        alert. ``actor_id`` is the authenticated caller and is what the audit
        event records — the two are deliberately kept apart so a caller cannot
        write an arbitrary identity into the audit trail.
        """
        alert = self.db.get(CriticalFindingAlert, alert_id)
        if not alert or alert.report_id != report_id:
            raise NotFoundError(f"Alert {alert_id} not found")
        if alert.acknowledged_at:
            raise ConflictError("Alert already acknowledged")

        now = utc_now()
        alert.acknowledged_by = acknowledged_by
        alert.acknowledged_at = now

        add_audit_event(
            self.db,
            event_type="critical_finding_acknowledged",
            actor_id=actor_id if actor_id is not None else acknowledged_by,
            report_id=report_id,
            metadata={"alert_id": alert_id, "finding_type": alert.finding_type},
            timestamp=now,
            source="api",
        )
        self.db.commit()
        return alert
