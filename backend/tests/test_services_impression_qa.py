"""Service-level tests for ImpressionService and QAService.

The route handlers are thin adapters over these services, so the branches that
are awkward to reach through HTTP are asserted here directly: the upstream
failure that becomes a 502, the audit provenance written alongside a generated
impression, and QA's configured-rules-vs-fallback split.

The services' async methods are driven with ``asyncio.run`` rather than an
async test plugin, which the backend does not use.
"""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from app.models import AuditEvent, QACheckResult, QARule, Report
from app.schemas import ImpressionRequest, QACheckRequest
from app.services import ImpressionService, QAService
from app.services.exceptions import NotFoundError, UpstreamError
from app.utils.time import utc_now

MODEL_RESULT = ("Kein Anhalt für Pneumothorax.", 0.91, "mock-medgemma-0.1", None)


def _audit_events(db, event_type: str) -> list[AuditEvent]:
    return db.query(AuditEvent).filter(AuditEvent.event_type == event_type).all()


def _patch_model(result=MODEL_RESULT, side_effect=None):
    return patch(
        "app.services.impression_service.generate_impression_text",
        side_effect=side_effect,
        return_value=result,
    )


def _generate(db, payload: ImpressionRequest):
    return asyncio.run(ImpressionService(db).generate(payload))


# ---------------------------------------------------------------------------
# ImpressionService
# ---------------------------------------------------------------------------


def test_generate_without_report_id_touches_nothing(db):
    with _patch_model():
        result = _generate(db, ImpressionRequest(findings_text="Befund"))

    assert result.text == MODEL_RESULT[0]
    assert result.persisted is False
    assert result.qa_status is None
    assert _audit_events(db, "impression_generated") == []


def test_generate_persists_impression_and_promotes_a_pending_report(db, sample_report):
    report_id = sample_report["id"]
    report = db.get(Report, report_id)
    report.status = "pending"
    db.commit()

    with _patch_model():
        result = _generate(db, ImpressionRequest(report_id=report_id, findings_text="Befund"))

    assert result.persisted is True
    assert result.qa_status == "pending"

    db.expire_all()
    report = db.get(Report, report_id)
    assert report.impression_text == MODEL_RESULT[0]
    assert report.status == "draft"


def test_generate_leaves_a_finalized_report_status_alone(db, sample_report):
    """Only pending/in_progress advance to draft — a finalized report must not."""
    report_id = sample_report["id"]
    report = db.get(Report, report_id)
    report.status = "finalized"
    db.commit()

    with _patch_model():
        _generate(db, ImpressionRequest(report_id=report_id, findings_text="Befund"))

    db.expire_all()
    assert db.get(Report, report_id).status == "finalized"


def test_generate_records_provenance_in_the_audit_event(db, sample_report):
    report_id = sample_report["id"]

    with _patch_model():
        _generate(
            db,
            ImpressionRequest(
                report_id=report_id,
                findings_text="Befund",
                image_urls=["https://pacs.example/img-1"],
            ),
        )

    events = _audit_events(db, "impression_generated")
    assert len(events) == 1
    metadata = events[0].metadata_json
    assert metadata["model"] == MODEL_RESULT[2]
    assert metadata["confidence"] == MODEL_RESULT[1]
    assert metadata["pipeline"] == "impression_service"
    # Hash and summary stand in for the request/response, which are not stored.
    assert metadata["input_hash"]
    assert metadata["output_summary"]


def test_model_metadata_overrides_the_defaults(db, sample_report):
    """A model reporting its own version wins over the name we defaulted to."""
    with _patch_model(result=(*MODEL_RESULT[:3], {"model_version": "medgemma-4b-it"})):
        _generate(db, ImpressionRequest(report_id=sample_report["id"], findings_text="Befund"))

    metadata = _audit_events(db, "impression_generated")[0].metadata_json
    assert metadata["model_version"] == "medgemma-4b-it"


def test_generate_rejects_an_unknown_report(db):
    with _patch_model(), pytest.raises(NotFoundError):
        _generate(db, ImpressionRequest(report_id="does-not-exist", findings_text="Befund"))


def test_an_unreachable_model_becomes_an_upstream_error(db):
    """The 502 the route returns starts here, without the service knowing about it."""
    with _patch_model(side_effect=RuntimeError("vLLM unreachable")):
        with pytest.raises(UpstreamError, match="vLLM unreachable"):
            _generate(db, ImpressionRequest(findings_text="Befund"))


def test_stream_ends_quietly_when_the_model_fails_mid_stream():
    """Headers are already sent by then, so the failure can only end the stream."""

    async def _tokens(*_args, **_kwargs):
        yield "Kein "
        yield "Anhalt"
        raise RuntimeError("connection reset")

    async def _collect() -> list[str]:
        payload = ImpressionRequest(findings_text="Befund")
        return [token async for token in ImpressionService.stream(payload)]

    with patch("app.services.impression_service.generate_impression_stream", _tokens):
        assert asyncio.run(_collect()) == ["Kein ", "Anhalt"]


# ---------------------------------------------------------------------------
# QAService
# ---------------------------------------------------------------------------


def _add_rule(db, *, name: str, severity: str = "fail", is_active: bool = True) -> QARule:
    now = utc_now()
    rule = QARule(
        name=name,
        rule_type="field_present",
        config_json={"target": "findings", "message": "Befund fehlt"},
        severity=severity,
        is_active=is_active,
        created_at=now,
        updated_at=now,
    )
    db.add(rule)
    db.commit()
    return rule


def test_evaluate_falls_back_to_the_builtin_checks(db):
    checks, _warnings, failures, score = QAService(db).evaluate("Befund", "Beurteilung")
    assert [c.name for c in checks[:-1]] == [
        "Findings vorhanden",
        "Impression vorhanden",
        "Detailgrad",
    ]
    assert failures == []
    assert 0.0 <= score <= 100.0


def test_configured_rules_replace_the_builtin_checks(db):
    _add_rule(db, name="Findings required")

    checks, _warnings, failures, _score = QAService(db).evaluate("", "Beurteilung")
    # The engine appends its own overall check; everything before it is the rules.
    assert [c.name for c in checks[:-1]] == ["Findings required"]
    assert failures == ["Befund fehlt"]


def test_inactive_rules_do_not_count_as_configuration(db):
    """One disabled rule must not leave the deployment with an empty rule set."""
    _add_rule(db, name="Disabled rule", is_active=False)

    checks, _warnings, _failures, _score = QAService(db).evaluate("", "")
    assert "Disabled rule" not in {c.name for c in checks}
    assert "Findings vorhanden" in {c.name for c in checks}


@pytest.mark.parametrize(
    ("warnings", "failures", "expected"),
    [
        ([], [], "pass"),
        (["kurz"], [], "warn"),
        (["kurz"], ["Befund fehlt"], "fail"),
        ([], ["Befund fehlt"], "fail"),
    ],
)
def test_derive_status(warnings, failures, expected):
    assert QAService.derive_status(warnings, failures) == expected


def test_run_without_report_id_stores_nothing(db):
    result = QAService(db).run(
        QACheckRequest(findings_text="Befund", impression_text="Beurteilung")
    )

    assert result.persisted is False
    assert db.query(QACheckResult).count() == 0
    assert _audit_events(db, "qa_check_run") == []


def test_run_writes_the_verdict_onto_the_report(db, sample_report):
    report_id = sample_report["id"]
    _add_rule(db, name="Findings required")

    result = QAService(db).run(QACheckRequest(report_id=report_id, findings_text=""))

    assert result.status == "fail"
    assert result.passes is False

    db.expire_all()
    report = db.get(Report, report_id)
    assert report.qa_status == "fail"
    assert report.qa_warnings == result.warnings

    stored = db.query(QACheckResult).filter(QACheckResult.report_id == report_id).one()
    assert stored.status == "fail"
    assert stored.failures == result.failures
    assert len(stored.checks) == len(result.checks)

    metadata = _audit_events(db, "qa_check_run")[0].metadata_json
    assert metadata["status"] == "fail"
    assert metadata["failures_count"] == len(result.failures)
    assert metadata["checks_count"] == len(result.checks)


def test_run_stores_a_check_for_a_report_that_does_not_exist(db):
    """Unsaved text is still worth checking, so a missing report is not an error."""
    result = QAService(db).run(QACheckRequest(report_id="not-saved-yet", findings_text="Befund"))

    assert result.persisted is True
    stored = db.query(QACheckResult).filter(QACheckResult.report_id == "not-saved-yet").one()
    assert stored.status == result.status
    assert _audit_events(db, "qa_check_run")[0].study_id is None
