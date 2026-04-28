from __future__ import annotations

import os
from pathlib import Path


def data_root() -> Path:
    root = Path(os.getenv("SEGMENTATION_DATA_DIR", "/data/segmentations"))
    root.mkdir(parents=True, exist_ok=True)
    return root


def job_dir(job_id: str) -> Path:
    path = data_root() / job_id
    path.mkdir(parents=True, exist_ok=True)
    (path / "raw").mkdir(exist_ok=True)
    (path / "masks").mkdir(exist_ok=True)
    (path / "meshes").mkdir(exist_ok=True)
    return path


def dicom_web_base_url() -> str:
    return os.getenv("DICOM_WEB_BASE_URL", "http://orthanc:8042/dicom-web").rstrip("/")


def dicom_web_credentials() -> tuple[str | None, str | None]:
    user = os.getenv("DICOM_WEB_USERNAME") or os.getenv("ORTHANC_USERNAME")
    pw = os.getenv("DICOM_WEB_PASSWORD") or os.getenv("ORTHANC_PASSWORD")
    return user, pw


def wado_concurrency() -> int:
    try:
        return max(1, int(os.getenv("SEGMENTER_MAX_PARALLEL_WADO", "8")))
    except ValueError:
        return 8


def bone_hu_threshold() -> float:
    try:
        return float(os.getenv("BONE_HU_THRESHOLD", "300"))
    except ValueError:
        return 300.0


def gpu_available() -> bool:
    try:
        import torch  # type: ignore

        return bool(torch.cuda.is_available())
    except Exception:
        return False
