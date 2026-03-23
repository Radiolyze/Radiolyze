from __future__ import annotations

import random
from datetime import UTC, datetime

from .schemas import QACheck

ASR_TRANSCRIPTS = [
    "Im CT Thorax mit Kontrastmittel zeigt sich ein 2,3 cm messender Rundherd im rechten Oberlappen.",
    "Die mediastinalen Lymphknoten sind unauffaellig, kein Nachweis von pathologisch vergroesserten Lymphknoten.",
    "Kein Pleuraerguss beidseits. Die Herzsilhouette ist normal konfiguriert.",
    "Im Vergleich zur Voruntersuchung vom 15.07.2023 zeigt sich eine Groessenprogredienz des bekannten Rundherdes.",
]

INFERENCE_SUMMARIES = [
    "Kein Hinweis auf akute Pathologie in den sichtbaren Bereichen.",
    "Diskrete basale Atelektasen beidseits, sonst unauffaellig.",
    "Rundherd rechts apikal, Verlaufskontrolle empfohlen.",
    "Hinweis auf degenerative Veraenderungen ohne Frakturzeichen.",
]


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def generate_asr_transcript() -> tuple[str, float]:
    text = random.choice(ASR_TRANSCRIPTS)
    confidence = round(random.uniform(0.88, 0.97), 2)
    return text, confidence


def generate_impression(findings_text: str | None) -> tuple[str, float]:
    findings_text = (findings_text or "").strip()
    if not findings_text:
        return "Keine relevanten Befunde fuer eine automatisierte Beurteilung vorliegend.", 0.72

    first_sentence = findings_text.split(".")[0].strip()
    if not first_sentence:
        first_sentence = findings_text[:160].strip()
    impression = (
        "Automatische Beurteilung (Entwurf): "
        f"{first_sentence}. Weitere Abklaerung je nach klinischem Kontext empfohlen."
    )
    return impression, round(random.uniform(0.78, 0.92), 2)


def generate_inference_summary(findings_text: str | None) -> tuple[str, float]:
    findings_text = (findings_text or "").strip()
    summary = ""
    if findings_text:
        summary = findings_text.split(".")[0].strip()
    if not summary:
        summary = random.choice(INFERENCE_SUMMARIES)
    else:
        summary = f"Automatische Bildanalyse: {summary}."
    confidence = round(random.uniform(0.76, 0.9), 2)
    return summary, confidence


def run_qa_checks(
    findings_text: str | None, impression_text: str | None
) -> tuple[list[QACheck], list[str], list[str], float]:
    findings_text = (findings_text or "").strip()
    impression_text = (impression_text or "").strip()

    checks: list[QACheck] = []
    warnings: list[str] = []
    failures: list[str] = []

    if findings_text:
        checks.append(QACheck(id="qa-findings", name="Findings vorhanden", status="pass"))
    else:
        failures.append("Findings fehlen")
        checks.append(
            QACheck(
                id="qa-findings",
                name="Findings vorhanden",
                status="fail",
                message="Findings fehlen",
            )
        )

    if impression_text:
        checks.append(QACheck(id="qa-impression", name="Impression vorhanden", status="pass"))
    else:
        failures.append("Impression fehlt")
        checks.append(
            QACheck(
                id="qa-impression",
                name="Impression vorhanden",
                status="fail",
                message="Impression fehlt",
            )
        )

    if findings_text and len(findings_text) < 50:
        warnings.append("Befund sehr kurz, Detailgrad pruefen.")
        checks.append(
            QACheck(
                id="qa-length",
                name="Detailgrad",
                status="warn",
                message="Befund sehr kurz, Detailgrad pruefen.",
            )
        )

    if "rundherd" in findings_text.lower():
        warnings.append("Fleischner-Kriterien fuer Rundherd pruefen.")
        checks.append(
            QACheck(
                id="qa-fleischner",
                name="Fleischner-Kriterien angewandt",
                status="warn",
                message="Fleischner-Kriterien fuer Rundherd pruefen.",
            )
        )

    status = "pass"
    if failures:
        status = "fail"
    elif warnings:
        status = "warn"

    checks.append(QACheck(id="qa-overall", name="QA Gesamtstatus", status=status))

    score = 92.0
    if failures:
        score = 60.0
    elif warnings:
        score = 78.0

    return checks, warnings, failures, score
