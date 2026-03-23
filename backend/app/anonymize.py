"""DICOM de-identification for training data export (DICOM PS3.15 Basic Profile)."""

from __future__ import annotations

import hashlib
from typing import Any

# DICOM tags that contain PHI and must be removed or replaced
# Based on DICOM PS3.15 Table E.1-1 (Basic Application Level Confidentiality Profile)
PHI_TAGS_TO_REMOVE = [
    "PatientName",
    "PatientBirthDate",
    "PatientBirthTime",
    "PatientAddress",
    "PatientTelephoneNumbers",
    "PatientMotherBirthName",
    "OtherPatientNames",
    "OtherPatientIDs",
    "OtherPatientIDsSequence",
    "ReferringPhysicianName",
    "ReferringPhysicianAddress",
    "ReferringPhysicianTelephoneNumbers",
    "InstitutionName",
    "InstitutionAddress",
    "InstitutionalDepartmentName",
    "PerformingPhysicianName",
    "OperatorsName",
    "NameOfPhysiciansReadingStudy",
    "RequestingPhysician",
    "MilitaryRank",
    "BranchOfService",
    "RegionOfResidence",
    "EthnicGroup",
    "Occupation",
    "MedicalRecordLocator",
    "ResponsiblePerson",
    "ResponsibleOrganization",
]

# Tags that get pseudonymized (replaced with hash-based IDs)
PHI_TAGS_TO_PSEUDONYMIZE = [
    "PatientID",
    "AccessionNumber",
    "StudyID",
]


def _pseudonymize(value: str, salt: str = "medgemma") -> str:
    """Generate a consistent pseudonym using SHA-256 hash."""
    if not value:
        return ""
    digest = hashlib.sha256(f"{salt}:{value}".encode()).hexdigest()
    return f"ANON-{digest[:12].upper()}"


def anonymize_metadata(
    metadata: dict[str, Any],
    salt: str = "medgemma",
) -> dict[str, Any]:
    """Anonymize a metadata dictionary by removing/replacing PHI fields.

    Args:
        metadata: Dictionary with DICOM-like field names.
        salt: Salt for pseudonymization hash (use consistent salt for longitudinal studies).

    Returns:
        New dictionary with PHI removed/replaced.
    """
    result = dict(metadata)

    # Remove PHI tags
    for tag in PHI_TAGS_TO_REMOVE:
        # Check both exact and snake_case variants
        result.pop(tag, None)
        snake = _to_snake_case(tag)
        result.pop(snake, None)

    # Pseudonymize IDs
    for tag in PHI_TAGS_TO_PSEUDONYMIZE:
        for key in [tag, _to_snake_case(tag)]:
            if key in result and result[key]:
                result[key] = _pseudonymize(str(result[key]), salt)

    return result


def anonymize_annotation(
    annotation_data: dict[str, Any],
    salt: str = "medgemma",
) -> dict[str, Any]:
    """Anonymize an annotation export entry."""
    result = dict(annotation_data)

    # Pseudonymize study/series/instance IDs
    for field in ["study_id", "series_id", "instance_id"]:
        if field in result and result[field]:
            result[field] = _pseudonymize(str(result[field]), salt)

    # Anonymize nested metadata
    if "metadata" in result and isinstance(result["metadata"], dict):
        result["metadata"] = anonymize_metadata(result["metadata"], salt)

    # Remove person names from annotation metadata
    for field in ["created_by", "verified_by"]:
        if field in result:
            result[field] = _pseudonymize(str(result[field] or ""), salt) if result[field] else None

    # Rebuild image paths and WADO URLs with anonymized IDs
    if "image_path" in result:
        anon_study = _pseudonymize(annotation_data.get("study_id", ""), salt)
        anon_series = _pseudonymize(annotation_data.get("series_id", ""), salt)
        anon_instance = _pseudonymize(annotation_data.get("instance_id", ""), salt)
        frame = annotation_data.get("frame_index", 0)
        result["image_path"] = f"images/{anon_study}_{anon_series}_{anon_instance}_{frame}.png"

    if "wado_url" in result:
        anon_study = _pseudonymize(annotation_data.get("study_id", ""), salt)
        anon_series = _pseudonymize(annotation_data.get("series_id", ""), salt)
        anon_instance = _pseudonymize(annotation_data.get("instance_id", ""), salt)
        frame = annotation_data.get("frame_index", annotation_data.get("frame_number", 1))
        result["wado_url"] = (
            f"/wado-rs/studies/{anon_study}/series/{anon_series}"
            f"/instances/{anon_instance}/frames/{frame}/rendered"
        )

    return result


def _to_snake_case(name: str) -> str:
    """Convert CamelCase to snake_case."""
    import re

    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()
