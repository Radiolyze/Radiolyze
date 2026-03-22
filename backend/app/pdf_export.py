"""PDF export for radiology reports using reportlab."""

from __future__ import annotations

import io
from datetime import datetime, timezone

from .models import Report

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.colors import HexColor
    _HAS_REPORTLAB = True
except ImportError:
    _HAS_REPORTLAB = False


def build_pdf_export(report: Report) -> tuple[bytes, str]:
    """Generate a PDF document for a radiology report.

    Returns (pdf_bytes, filename).
    """
    if not _HAS_REPORTLAB:
        raise RuntimeError("reportlab is required for PDF export. Install with: pip install reportlab")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=16,
        spaceAfter=6,
        alignment=TA_CENTER,
    )

    section_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontSize=12,
        spaceBefore=12,
        spaceAfter=6,
        textColor=HexColor("#1a365d"),
    )

    body_style = ParagraphStyle(
        "BodyText",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        spaceAfter=8,
    )

    meta_style = ParagraphStyle(
        "MetaText",
        parent=styles["Normal"],
        fontSize=9,
        textColor=HexColor("#555555"),
    )

    elements = []

    # Header
    elements.append(Paragraph("Radiologischer Befundbericht", title_style))
    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=HexColor("#1a365d")))
    elements.append(Spacer(1, 4 * mm))

    # Patient metadata table
    now_str = datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M UTC")
    meta_data = [
        ["Patienten-ID:", report.patient_id, "Studien-ID:", report.study_id],
        ["Status:", report.status.upper(), "Erstellt:", report.created_at[:19] if report.created_at else "—"],
        ["Genehmigt von:", report.approved_by or "—", "Genehmigt am:", report.approved_at[:19] if report.approved_at else "—"],
        ["QA-Status:", report.qa_status.upper(), "Exportiert:", now_str],
    ]

    meta_table = Table(meta_data, colWidths=[80, 140, 80, 140])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), HexColor("#333333")),
        ("TEXTCOLOR", (2, 0), (2, -1), HexColor("#333333")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 6 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#cccccc")))

    # Findings
    elements.append(Paragraph("Befund", section_style))
    findings = report.findings_text.strip() if report.findings_text else "Kein Befund erfasst."
    for paragraph in findings.split("\n"):
        if paragraph.strip():
            elements.append(Paragraph(paragraph.strip(), body_style))

    elements.append(Spacer(1, 4 * mm))

    # Impression
    elements.append(Paragraph("Beurteilung", section_style))
    impression = report.impression_text.strip() if report.impression_text else "Keine Beurteilung erfasst."
    for paragraph in impression.split("\n"):
        if paragraph.strip():
            elements.append(Paragraph(paragraph.strip(), body_style))

    elements.append(Spacer(1, 6 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#cccccc")))
    elements.append(Spacer(1, 4 * mm))

    # QA warnings
    if report.qa_warnings:
        elements.append(Paragraph("QA-Hinweise", section_style))
        for warning in report.qa_warnings:
            elements.append(Paragraph(f"• {warning}", meta_style))
        elements.append(Spacer(1, 4 * mm))

    # Signature
    if report.approved_by:
        elements.append(Spacer(1, 10 * mm))
        elements.append(Paragraph(f"Digital signiert von: {report.approved_by}", meta_style))
        elements.append(Paragraph(f"Datum: {report.approved_at[:19] if report.approved_at else now_str}", meta_style))

    # Footer
    elements.append(Spacer(1, 8 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#cccccc")))
    elements.append(Paragraph(
        f"Generiert von MedGemma Insight | Report-ID: {report.id} | {now_str}",
        ParagraphStyle("Footer", parent=meta_style, fontSize=7, textColor=HexColor("#999999"), alignment=TA_CENTER),
    ))

    doc.build(elements)
    buffer.seek(0)
    filename = f"report-{report.id}.pdf"
    return buffer.read(), filename
