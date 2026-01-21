from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from .models import Report

SR_SOP_CLASS_UID = "1.2.840.10008.5.1.4.1.1.88.11"
SR_MEDIA_TYPE = "application/dicom+json"


def _new_uid() -> str:
    return f"2.25.{uuid.uuid4().int}"


def _content_datetime() -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y%m%d"), now.strftime("%H%M%S")


def build_sr_payload(report: Report) -> dict[str, Any]:
    content_date, content_time = _content_datetime()
    sr_instance_uid = _new_uid()
    sr_series_uid = _new_uid()

    return {
        "format": "dicom-sr-json-draft",
        "sopClassUid": SR_SOP_CLASS_UID,
        "sopInstanceUid": sr_instance_uid,
        "studyInstanceUid": report.study_id,
        "seriesInstanceUid": sr_series_uid,
        "modality": "SR",
        "contentDate": content_date,
        "contentTime": content_time,
        "patientId": report.patient_id,
        "reportId": report.id,
        "reportStatus": report.status,
        "reportTimestamps": {
            "createdAt": report.created_at,
            "updatedAt": report.updated_at,
            "approvedAt": report.approved_at,
        },
        "author": report.approved_by,
        "sections": [
            {"title": "Findings", "text": report.findings_text},
            {"title": "Impression", "text": report.impression_text},
        ],
    }


def build_sr_export(report: Report) -> tuple[bytes, str, str]:
    payload = build_sr_payload(report)
    content = json.dumps(payload, ensure_ascii=True, indent=2)
    filename = f"report-{report.id}-sr.json"
    return content.encode("utf-8"), filename, SR_MEDIA_TYPE
