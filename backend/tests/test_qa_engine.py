"""Tests for the configurable QA rule engine."""

from __future__ import annotations

from app.models import QARule
from app.qa_engine import detect_critical_findings, evaluate_rules


def _make_rule(
    rule_type: str,
    config: dict,
    name: str = "test-rule",
    severity: str = "warn",
    is_active: bool = True,
) -> QARule:
    """Create a QARule instance for testing (not persisted)."""
    rule = QARule(
        id="rule-test-001",
        name=name,
        rule_type=rule_type,
        config_json=config,
        is_active=is_active,
        severity=severity,
        created_at="2025-01-01T00:00:00Z",
        updated_at="2025-01-01T00:00:00Z",
    )
    return rule


class TestEvalRequiredKeyword:
    def test_keyword_present(self):
        rule = _make_rule("required_keyword", {"keyword": "Lunge", "target": "findings"})
        checks, warnings, failures, score = evaluate_rules([rule], "Lunge unauffällig", "")
        assert all(c.status == "pass" for c in checks if c.id != "qa-overall")

    def test_keyword_missing(self):
        rule = _make_rule(
            "required_keyword", {"keyword": "Lunge", "target": "findings", "message": "Lunge fehlt"}
        )
        checks, warnings, failures, score = evaluate_rules([rule], "Herz unauffällig", "")
        assert "Lunge fehlt" in warnings

    def test_case_insensitive(self):
        rule = _make_rule(
            "required_keyword", {"keyword": "LUNGE", "case_sensitive": False, "target": "findings"}
        )
        checks, _, _, _ = evaluate_rules([rule], "lunge unauffällig", "")
        passed = [c for c in checks if c.id != "qa-overall" and c.status == "pass"]
        assert len(passed) == 1

    def test_case_sensitive(self):
        rule = _make_rule(
            "required_keyword", {"keyword": "LUNGE", "case_sensitive": True, "target": "findings"}
        )
        checks, warnings, _, _ = evaluate_rules([rule], "lunge unauffällig", "")
        assert len(warnings) == 1


class TestEvalMinMaxLength:
    def test_min_length_pass(self):
        rule = _make_rule("min_length", {"min_length": 5, "target": "findings"})
        checks, _, _, _ = evaluate_rules([rule], "Lunge unauffällig", "")
        assert all(c.status == "pass" for c in checks if c.id != "qa-overall")

    def test_min_length_fail(self):
        rule = _make_rule(
            "min_length",
            {"min_length": 100, "target": "findings", "message": "Zu kurz"},
            severity="fail",
        )
        _, _, failures, _ = evaluate_rules([rule], "Kurz", "")
        assert "Zu kurz" in failures

    def test_max_length_pass(self):
        rule = _make_rule("max_length", {"max_length": 1000, "target": "findings"})
        checks, _, _, _ = evaluate_rules([rule], "Normal", "")
        assert all(c.status == "pass" for c in checks if c.id != "qa-overall")

    def test_max_length_fail(self):
        rule = _make_rule(
            "max_length", {"max_length": 5, "target": "findings", "message": "Zu lang"}
        )
        _, warnings, _, _ = evaluate_rules([rule], "This is way too long", "")
        assert "Zu lang" in warnings


class TestEvalRegex:
    def test_regex_match(self):
        rule = _make_rule("regex_match", {"pattern": r"\d+\s*(mm|cm)", "target": "findings"})
        checks, _, _, _ = evaluate_rules([rule], "Knoten 15 mm", "")
        assert all(c.status == "pass" for c in checks if c.id != "qa-overall")

    def test_regex_no_match(self):
        rule = _make_rule(
            "regex_match",
            {"pattern": r"\d+\s*(mm|cm)", "target": "findings", "message": "Maße fehlen"},
        )
        _, warnings, _, _ = evaluate_rules([rule], "Knoten vorhanden", "")
        assert "Maße fehlen" in warnings


class TestEvalFieldPresent:
    def test_field_present(self):
        rule = _make_rule("field_present", {"target": "impression"})
        checks, _, _, _ = evaluate_rules([rule], "", "Normalbefund")
        assert all(c.status == "pass" for c in checks if c.id != "qa-overall")

    def test_field_empty(self):
        rule = _make_rule("field_present", {"target": "impression", "message": "Impression fehlt"})
        _, warnings, _, _ = evaluate_rules([rule], "Findings vorhanden", "")
        assert "Impression fehlt" in warnings


class TestInactiveRules:
    def test_inactive_rule_skipped(self):
        rule = _make_rule("min_length", {"min_length": 1000, "target": "findings"}, is_active=False)
        checks, warnings, failures, score = evaluate_rules([rule], "Short", "")
        # Only the overall check should be present
        assert len(checks) == 1
        assert checks[0].id == "qa-overall"


class TestScoring:
    def test_all_pass_score_100(self):
        rule = _make_rule("field_present", {"target": "findings"})
        _, _, _, score = evaluate_rules([rule], "Content", "")
        assert score == 100.0

    def test_all_fail_score_0(self):
        rule = _make_rule(
            "field_present", {"target": "findings", "message": "Missing"}, severity="fail"
        )
        _, _, _, score = evaluate_rules([rule], "", "")
        assert score == 0.0


class TestCriticalFindings:
    def test_detect_pneumothorax_german(self):
        results = detect_critical_findings("Pneumothorax rechts", "")
        assert any(r["finding_type"] == "Pneumothorax" for r in results)

    def test_detect_stroke_english(self):
        results = detect_critical_findings("Acute stroke detected", "")
        assert any(r["finding_type"] == "Stroke" for r in results)

    def test_detect_from_impression(self):
        results = detect_critical_findings("", "Lungenembolie nicht ausgeschlossen")
        assert any(r["finding_type"] == "Lungenembolie" for r in results)

    def test_no_critical_findings(self):
        results = detect_critical_findings("Normalbefund", "Unauffällig")
        assert results == []

    def test_custom_rule_detection(self):
        rule = _make_rule(
            "critical_finding", {"keyword": "fraktur"}, name="Fraktur", severity="critical"
        )
        results = detect_critical_findings("Fraktur des Femurs", "", rules=[rule])
        assert any(r["finding_type"] == "Fraktur" for r in results)

    def test_no_duplicate_when_rule_and_default_match(self):
        rule = _make_rule(
            "critical_finding",
            {"keyword": "pneumothorax"},
            name="Custom Pneumothorax",
            severity="critical",
        )
        results = detect_critical_findings("Pneumothorax rechts", "", rules=[rule])
        pneumothorax_matches = [r for r in results if "pneumothorax" in r["matched_text"].lower()]
        assert len(pneumothorax_matches) == 1
