"""DICOM de-identification for training data export (DICOM PS3.15 Basic Profile).

This module pseudonymizes *values*: a DICOM identifier in, a stable ``ANON-``
token out. It deliberately knows nothing about how an export addresses a frame
-- the study/series/instance/frame key, the image path and the WADO-RS URL are
built in ``app.services.training_export.images`` from ids that were already run
through :func:`pseudonymize` there, so a pseudonym and the key it appears in
can never disagree.
"""

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
            if key in result and result[key]:
                result[key] = pseudonymize(str(result[key]), salt)

    return result


def _to_snake_case(name: str) -> str:
    """Convert CamelCase to snake_case."""
    import re

    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()
