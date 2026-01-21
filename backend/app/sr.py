from __future__ import annotations

import io
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from .models import Report

SR_SOP_CLASS_UID = "1.2.840.10008.5.1.4.1.1.88.11"
SR_MEDIA_TYPE_JSON = "application/dicom+json"
SR_MEDIA_TYPE_BINARY = "application/dicom"

try:
    import pydicom
    from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
    from pydicom.sequence import Sequence
    from pydicom.uid import ExplicitVRLittleEndian, PYDICOM_IMPLEMENTATION_UID
except ImportError:  # pragma: no cover - handled at runtime
    pydicom = None
    Dataset = None
    FileDataset = None
    FileMetaDataset = None
    Sequence = None
    ExplicitVRLittleEndian = None
    PYDICOM_IMPLEMENTATION_UID = None


def _new_uid() -> str:
    return f"2.25.{uuid.uuid4().int}"


def _content_datetime() -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y%m%d"), now.strftime("%H%M%S")


def _code_item(code: str, scheme: str, meaning: str) -> Any:
    item = Dataset()
    item.CodeValue = code
    item.CodingSchemeDesignator = scheme
    item.CodeMeaning = meaning
    return item


def _build_sr_dataset(report: Report) -> Any:
    if pydicom is None:
        raise RuntimeError("pydicom is required for binary SR export")

    content_date, content_time = _content_datetime()
    sr_instance_uid = _new_uid()
    sr_series_uid = _new_uid()

    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = SR_SOP_CLASS_UID
    file_meta.MediaStorageSOPInstanceUID = sr_instance_uid
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    file_meta.ImplementationClassUID = PYDICOM_IMPLEMENTATION_UID

    dataset = FileDataset(None, {}, file_meta=file_meta, preamble=b"\0" * 128)
    dataset.is_little_endian = True
    dataset.is_implicit_VR = False
    dataset.SOPClassUID = SR_SOP_CLASS_UID
    dataset.SOPInstanceUID = sr_instance_uid
    dataset.Modality = "SR"
    dataset.SpecificCharacterSet = "ISO_IR 192"
    dataset.StudyInstanceUID = report.study_id
    dataset.SeriesInstanceUID = sr_series_uid
    dataset.SeriesNumber = 1
    dataset.InstanceNumber = 1
    dataset.PatientID = report.patient_id
    dataset.ContentDate = content_date
    dataset.ContentTime = content_time
    dataset.StudyDate = content_date
    dataset.StudyTime = content_time
    dataset.CompletionFlag = "COMPLETE" if report.status == "finalized" else "PARTIAL"
    dataset.VerificationFlag = "VERIFIED" if report.approved_by else "UNVERIFIED"

    root = Dataset()
    root.ValueType = "CONTAINER"
    root.ContinuityOfContent = "SEPARATE"
    root.ConceptNameCodeSequence = Sequence(
        [_code_item("18748-4", "LN", "Diagnostic imaging report")]
    )
    root.ContentSequence = Sequence()

    if report.findings_text:
        findings = Dataset()
        findings.RelationshipType = "CONTAINS"
        findings.ValueType = "TEXT"
        findings.ConceptNameCodeSequence = Sequence(
            [_code_item("121071", "DCM", "Findings")]
        )
        findings.TextValue = report.findings_text
        root.ContentSequence.append(findings)

    if report.impression_text:
        impression = Dataset()
        impression.RelationshipType = "CONTAINS"
        impression.ValueType = "TEXT"
        impression.ConceptNameCodeSequence = Sequence(
            [_code_item("121073", "DCM", "Impression")]
        )
        impression.TextValue = report.impression_text
        root.ContentSequence.append(impression)

    dataset.ContentSequence = Sequence([root])

    if report.approved_by:
        verifier = Dataset()
        verifier.VerifyingObserverName = report.approved_by
        dataset.VerifyingObserverSequence = Sequence([verifier])

    return dataset


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


def build_sr_export(report: Report, export_format: str) -> tuple[bytes, str, str]:
    normalized = export_format.lower()
    if normalized == "dicom":
        dataset = _build_sr_dataset(report)
        buffer = io.BytesIO()
        pydicom.dcmwrite(buffer, dataset, write_like_original=False)
        filename = f"report-{report.id}-sr.dcm"
        return buffer.getvalue(), filename, SR_MEDIA_TYPE_BINARY

    payload = build_sr_payload(report)
    content = json.dumps(payload, ensure_ascii=True, indent=2)
    filename = f"report-{report.id}-sr.json"
    return content.encode("utf-8"), filename, SR_MEDIA_TYPE_JSON
