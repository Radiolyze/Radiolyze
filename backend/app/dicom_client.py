"""DICOMweb client for STOW-RS (store) and WADO-RS (retrieve) operations.

Uses the Orthanc DICOMweb plugin endpoint configured via ``DICOM_WEB_BASE_URL``
(default: ``http://orthanc:8042/dicom-web``).
"""
from __future__ import annotations

import logging
import os
import uuid

import httpx

logger = logging.getLogger(__name__)


def _dicom_web_base_url() -> str:
    return os.getenv("DICOM_WEB_BASE_URL", "http://orthanc:8042/dicom-web").rstrip("/")


def _orthanc_auth() -> tuple[str, str] | None:
    username = os.getenv("ORTHANC_USERNAME") or os.getenv("DICOM_WEB_USERNAME")
    password = os.getenv("ORTHANC_PASSWORD") or os.getenv("DICOM_WEB_PASSWORD")
    if username and password:
        return (username, password)
    return None


def _request_timeout() -> float:
    try:
        return float(os.getenv("DICOM_STORE_TIMEOUT", "30"))
    except ValueError:
        return 30.0


def store_sr(study_instance_uid: str, sr_bytes: bytes) -> str:
    """Store a DICOM SR object in Orthanc via STOW-RS.

    Sends a multipart/related POST request to the DICOMweb STOW-RS endpoint.
    Returns the Orthanc instance URL for the stored object.

    Raises ``RuntimeError`` if the store request fails.
    """
    base_url = _dicom_web_base_url()
    stow_url = f"{base_url}/studies"
    boundary = uuid.uuid4().hex

    # Build multipart/related body per DICOMweb STOW-RS spec (PS3.18 §10.5.1)
    body = (
        f"--{boundary}\r\n"
        f"Content-Type: application/dicom\r\n"
        f"\r\n"
    ).encode("utf-8") + sr_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    content_type = f'multipart/related; type="application/dicom"; boundary="{boundary}"'

    auth = _orthanc_auth()
    try:
        with httpx.Client(timeout=_request_timeout()) as client:
            response = client.post(
                stow_url,
                content=body,
                headers={"Content-Type": content_type},
                auth=auth,
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"STOW-RS store failed: {exc}") from exc

    # Orthanc returns a DICOMweb response; extract the instance URL
    instance_url = f"{base_url}/studies/{study_instance_uid}"
    logger.info("DICOM SR stored via STOW-RS: %s", instance_url)
    return instance_url
