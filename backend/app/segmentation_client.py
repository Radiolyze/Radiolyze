from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Any, Iterator

import httpx

logger = logging.getLogger(__name__)

_CRED_RE = re.compile(r"(https?://)([^:]+:[^@]+)@")


def _redact_url(url: str) -> str:
    return _CRED_RE.sub(r"\1***:***@", url)


def segmenter_base_url() -> str:
    return os.getenv("SEGMENTER_URL", "http://segmenter:8200").rstrip("/")


def segmenter_timeout() -> float:
    try:
        return float(os.getenv("SEGMENTER_REQUEST_TIMEOUT", "30"))
    except ValueError:
        return 30.0


def segmentation_data_dir() -> Path:
    path = Path(os.getenv("SEGMENTATION_DATA_DIR", "/data/segmentations"))
    path.mkdir(parents=True, exist_ok=True)
    return path


def submit_segmentation(
    *,
    job_id: str,
    study_uid: str,
    series_uid: str,
    preset: str,
    options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    url = f"{segmenter_base_url()}/segment/{preset}"
    payload = {
        "job_id": job_id,
        "study_uid": study_uid,
        "series_uid": series_uid,
        "options": options or {},
    }
    logger.info("Submitting segmentation job %s to %s", job_id, _redact_url(url))
    with httpx.Client(timeout=segmenter_timeout()) as client:
        response = client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


def get_job_status(job_id: str) -> dict[str, Any]:
    url = f"{segmenter_base_url()}/jobs/{job_id}"
    with httpx.Client(timeout=segmenter_timeout()) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.json()


def stream_mesh(job_id: str, label_id: int, *, fmt: str = "glb") -> Iterator[bytes]:
    url = f"{segmenter_base_url()}/jobs/{job_id}/mesh/{label_id}"
    params = {"format": fmt}
    with httpx.Client(timeout=None) as client:
        with client.stream("GET", url, params=params) as response:
            response.raise_for_status()
            yield from response.iter_bytes()


def stream_mask(job_id: str, label_id: int) -> Iterator[bytes]:
    url = f"{segmenter_base_url()}/jobs/{job_id}/mask/{label_id}"
    with httpx.Client(timeout=None) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            yield from response.iter_bytes()


def download_dicom_seg(job_id: str) -> bytes:
    """Pull the multi-class DICOM SEG object from the segmenter as bytes.

    The segmenter writes ``segmentation.dcm`` next to the manifest after
    meshing. Reading it back over HTTP keeps the orchestrator free from
    pydicom-seg + ITK on its hot path.
    """
    url = f"{segmenter_base_url()}/jobs/{job_id}/dicom-seg"
    with httpx.Client(timeout=segmenter_timeout()) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.content
