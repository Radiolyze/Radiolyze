"""Quality-assurance checks on a report's findings and impression.

Holds the business logic that previously lived inline in the
``/api/v1/reports/qa-check`` route handler: choosing between the configured
``QARule`` rows and the built-in fallback checks, deriving the pass/warn/fail
verdict, and persisting the result onto the report plus its audit trail. HTTP
concerns (the response model, the WebSocket broadcast) stay in
``app.api.reports``.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from ..audit import add_audit_event
from ..mock_logic import run_qa_checks
from ..models import QACheckResult, QARule, Report
from ..qa_engine import evaluate_rules
from ..schemas import QACheck, QACheckRequest
from ..utils.hashing import compute_text_hash
from ..utils.time import utc_now

# Identifies the rules engine in the audit trail, so a stored result can be
# traced back to the logic that produced it.
ENGINE_VERSION = "qa-rules-v1"


@dataclass(frozen=True)
class QAResult:
    checks: list[QACheck]
    warnings: list[str]
    failures: list[str]
    quality_score: float
    status: str
    persisted: bool

    @property
    def passes(self) -> bool:
        return not self.failures


class QAService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Evaluation
    # ------------------------------------------------------------------
    def evaluate(
        self, findings_text: str | None, impression_text: str | None
    ) -> tuple[list[QACheck], list[str], list[str], float]:
        """Run the configured rules, falling back to the built-in checks.

        Any active ``QARule`` rows replace the hardcoded logic wholesale rather
        than adding to it — a deployment that configures its own rules gets
        exactly those.
        """
        active_rules = self.db.query(QARule).filter(QARule.is_active).all()
        if active_rules:
            return evaluate_rules(active_rules, findings_text or "", impression_text or "")
        return run_qa_checks(findings_text, impression_text)

    @staticmethod
    def derive_status(warnings: list[str], failures: list[str]) -> str:
        if failures:
            return "fail"
        if warnings:
            return "warn"
        return "pass"

    # ------------------------------------------------------------------
    # Run + persist
    # ------------------------------------------------------------------
    def run(self, payload: QACheckRequest) -> QAResult:
        """Evaluate a report and, when one is named, record the outcome.

        A ``report_id`` naming a report that does not exist is not an error:
        the check still runs and is stored, matching the pre-existing route
        behaviour — the result row and audit event stand on their own, and the
        caller may be checking text that has not been saved yet.
        """
        checks, warnings, failures, score = self.evaluate(
            payload.findings_text, payload.impression_text
        )
        status = self.derive_status(warnings, failures)

        result = QAResult(
            checks=checks,
            warnings=warnings,
            failures=failures,
            quality_score=score,
            status=status,
            persisted=bool(payload.report_id),
        )
        if not payload.report_id:
            return result

        now = utc_now()
        report = self.db.get(Report, payload.report_id)
        if report:
            report.qa_status = status
            report.qa_warnings = warnings
            report.updated_at = now

        self.db.add(
            QACheckResult(
                report_id=payload.report_id,
                status=status,
                checks=[check.model_dump() for check in checks],
                warnings=warnings,
                failures=failures,
                quality_score=score,
                created_at=now,
            )
        )
        add_audit_event(
            self.db,
            event_type="qa_check_run",
            actor_id="system",
            report_id=payload.report_id,
            study_id=report.study_id if report else None,
            metadata={
                "model_version": ENGINE_VERSION,
                "engine": "rules",
                "engine_version": ENGINE_VERSION,
                "status": status,
                "warnings_count": len(warnings),
                "failures_count": len(failures),
                "checks_count": len(checks),
                "quality_score": score,
                "input_hash": compute_text_hash(payload.findings_text, payload.impression_text),
                "output_summary": f"{status} (warnings={len(warnings)}, failures={len(failures)})",
            },
            timestamp=now,
            source="api",
        )
        self.db.commit()

        return result
