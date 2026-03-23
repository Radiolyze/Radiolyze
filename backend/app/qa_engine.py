"""Configurable QA rule engine replacing hardcoded mock logic."""

from __future__ import annotations

import re
from typing import Any

from .models import QARule
from .schemas import QACheck


def _eval_required_keyword(text: str, config: dict[str, Any]) -> bool:
    keyword = config.get("keyword", "")
    case_sensitive = config.get("case_sensitive", False)
    if not keyword:
        return True
    if case_sensitive:
        return keyword in text
    return keyword.lower() in text.lower()


def _eval_min_length(text: str, config: dict[str, Any]) -> bool:
    min_len = config.get("min_length", 0)
    return len(text.strip()) >= min_len


def _eval_max_length(text: str, config: dict[str, Any]) -> bool:
    max_len = config.get("max_length", 100000)
    return len(text.strip()) <= max_len


def _eval_regex_match(text: str, config: dict[str, Any]) -> bool:
    pattern = config.get("pattern", "")
    if not pattern:
        return True
    flags = re.IGNORECASE if not config.get("case_sensitive", False) else 0
    return bool(re.search(pattern, text, flags))


def _eval_field_present(text: str, config: dict[str, Any]) -> bool:
    return len(text.strip()) > 0


_EVALUATORS = {
    "required_keyword": _eval_required_keyword,
    "min_length": _eval_min_length,
    "max_length": _eval_max_length,
    "regex_match": _eval_regex_match,
    "field_present": _eval_field_present,
}


def evaluate_rules(
    rules: list[QARule],
    findings_text: str,
    impression_text: str,
) -> tuple[list[QACheck], list[str], list[str], float]:
    """Evaluate all active QA rules and return checks, warnings, failures, score."""
    findings_text = (findings_text or "").strip()
    impression_text = (impression_text or "").strip()

    checks: list[QACheck] = []
    warnings: list[str] = []
    failures: list[str] = []

    for rule in rules:
        if not rule.is_active:
            continue

        evaluator = _EVALUATORS.get(rule.rule_type)
        if not evaluator:
            continue

        target_field = rule.config_json.get("target", "findings")
        text = findings_text if target_field == "findings" else impression_text

        passed = evaluator(text, rule.config_json)
        message = rule.config_json.get("message", rule.name)

        if passed:
            checks.append(QACheck(id=f"qa-{rule.id}", name=rule.name, status="pass"))
        else:
            status = "fail" if rule.severity == "fail" else "warn"
            checks.append(
                QACheck(id=f"qa-{rule.id}", name=rule.name, status=status, message=message)
            )
            if status == "fail":
                failures.append(message)
            else:
                warnings.append(message)

    # Overall status
    overall = "pass"
    if failures:
        overall = "fail"
    elif warnings:
        overall = "warn"
    checks.append(QACheck(id="qa-overall", name="QA Gesamtstatus", status=overall))

    # Score
    total = max(len(checks) - 1, 1)
    passed_count = sum(1 for c in checks if c.status == "pass" and c.id != "qa-overall")
    score = round((passed_count / total) * 100, 1)

    return checks, warnings, failures, score


# ---------------------------------------------------------------------------
# Critical Finding Detection
# ---------------------------------------------------------------------------

# Default keywords that indicate a critical finding requiring immediate
# communication to the referring physician (configurable via QA rules with
# rule_type="critical_finding").
_DEFAULT_CRITICAL_PATTERNS: list[dict[str, str]] = [
    {"keyword": "pneumothorax", "finding_type": "Pneumothorax"},
    {"keyword": "lungenembolie", "finding_type": "Lungenembolie"},
    {"keyword": "pulmonary embolism", "finding_type": "Pulmonary Embolism"},
    {"keyword": "aortendissektion", "finding_type": "Aortendissektion"},
    {"keyword": "aortic dissection", "finding_type": "Aortic Dissection"},
    {"keyword": "intrakranielle blutung", "finding_type": "Intrakranielle Blutung"},
    {"keyword": "intracranial hemorrhage", "finding_type": "Intracranial Hemorrhage"},
    {"keyword": "schlaganfall", "finding_type": "Schlaganfall"},
    {"keyword": "stroke", "finding_type": "Stroke"},
    {"keyword": "spannungspneumothorax", "finding_type": "Spannungspneumothorax"},
    {"keyword": "tension pneumothorax", "finding_type": "Tension Pneumothorax"},
    {"keyword": "perikarderguss", "finding_type": "Perikarderguss"},
    {"keyword": "pericardial effusion", "finding_type": "Pericardial Effusion"},
    {"keyword": "freie luft", "finding_type": "Freie abdominelle Luft"},
    {"keyword": "free air", "finding_type": "Free Abdominal Air"},
]


def detect_critical_findings(
    findings_text: str,
    impression_text: str,
    rules: list[QARule] | None = None,
) -> list[dict[str, str]]:
    """Return a list of detected critical findings from findings/impression text.

    Each item: {"finding_type": ..., "severity": ..., "matched_text": ...}
    """
    combined = f"{findings_text or ''} {impression_text or ''}".lower()
    results: list[dict[str, str]] = []

    # Check DB-configured critical finding rules
    if rules:
        for rule in rules:
            if rule.rule_type != "critical_finding" or not rule.is_active:
                continue
            keyword = rule.config_json.get("keyword", "").lower()
            if keyword and keyword in combined:
                results.append(
                    {
                        "finding_type": rule.name,
                        "severity": rule.severity or "critical",
                        "matched_text": keyword,
                    }
                )

    # Check default patterns
    for pattern in _DEFAULT_CRITICAL_PATTERNS:
        kw = pattern["keyword"]
        if kw in combined:
            # Avoid duplicates if already matched by a DB rule
            if not any(r["matched_text"] == kw for r in results):
                results.append(
                    {
                        "finding_type": pattern["finding_type"],
                        "severity": "critical",
                        "matched_text": kw,
                    }
                )

    return results
