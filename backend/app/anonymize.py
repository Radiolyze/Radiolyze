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

#: The frame identifiers a training export maps itself, before a sample is ever
#: built -- see ``app.services.training_export.identifiers``. The same three ids
#: also form the frame key, the image path and the WADO URL, so they have to be
#: mapped once, together. Hashing them a second time here would pull the sample's
#: metadata out of step with the key built from the same ids, which is why the
#: metadata scrub steps over them.
#:
#: Only the snake_case spellings are listed: ``StudyID`` as a genuine DICOM
#: attribute is still pseudonymized, it is the export's own ``study_id`` field
#: that is already taken care of.
FRAME_ID_FIELDS = frozenset({"study_id", "series_id", "instance_id"})


def pseudonymize(value: str, salt: str = "medgemma") -> str:
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
            if key in FRAME_ID_FIELDS:
                continue
            if key in result and result[key]:
                result[key] = pseudonymize(str(result[key]), salt)

    return result


def anonymize_annotation(
    annotation_data: dict[str, Any],
    salt: str = "medgemma",
) -> dict[str, Any]:
    """Scrub the PHI an export sample carries beyond its frame identifiers.

    The study, series and instance ids are deliberately *not* touched here. A
    sample identifies its frame in four places at once -- the key, the image
    path, the WADO URL and its own id fields -- and those only agree if the
    three ids are mapped in one pass, while the sample is built. The training
    export does that through ``Identifiers``; rewriting them again afterwards
    is what used to leave an anonymized dataset unable to find its own images.

    What is left for this function is the PHI that is *not* an identifier: the
    DICOM attributes carried under ``metadata`` and the names of the people who
    drew and verified the annotation.
    """
    result = dict(annotation_data)

    # Anonymize nested metadata
    if "metadata" in result and isinstance(result["metadata"], dict):
        result["metadata"] = anonymize_metadata(result["metadata"], salt)

    # Remove person names from annotation metadata
    for field in ["created_by", "verified_by"]:
        if field in result:
            result[field] = pseudonymize(str(result[field] or ""), salt) if result[field] else None

    return result


def _to_snake_case(name: str) -> str:
    """Convert CamelCase to snake_case."""
    import re

    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()
