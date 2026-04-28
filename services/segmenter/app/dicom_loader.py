from __future__ import annotations

import asyncio
import io
import logging
from dataclasses import dataclass

import httpx
import numpy as np
import pydicom
import SimpleITK as sitk

from .config import dicom_web_credentials, wado_concurrency

logger = logging.getLogger(__name__)


@dataclass
class LoadedVolume:
    image: sitk.Image
    modality: str
    instance_count: int


def _instance_url(base_url: str, study_uid: str, series_uid: str, instance_uid: str) -> str:
    return f"{base_url}/studies/{study_uid}/series/{series_uid}/instances/{instance_uid}"


async def _list_instances(
    client: httpx.AsyncClient, base_url: str, study_uid: str, series_uid: str
) -> list[dict]:
    qido = f"{base_url}/studies/{study_uid}/series/{series_uid}/instances"
    resp = await client.get(qido, headers={"Accept": "application/dicom+json"})
    resp.raise_for_status()
    return resp.json() or []


async def _fetch_instance(
    client: httpx.AsyncClient, base_url: str, study_uid: str, series_uid: str, instance_uid: str
) -> pydicom.Dataset:
    url = _instance_url(base_url, study_uid, series_uid, instance_uid)
    resp = await client.get(url, headers={"Accept": "application/dicom; transfer-syntax=*"})
    resp.raise_for_status()
    body = resp.content
    # WADO-RS returns multipart/related with a single DICOM part.
    boundary = _extract_boundary(resp.headers.get("content-type", ""))
    raw = _strip_multipart(body, boundary) if boundary else body
    return pydicom.dcmread(io.BytesIO(raw), force=True)


def _extract_boundary(content_type: str) -> str | None:
    for token in content_type.split(";"):
        token = token.strip()
        if token.lower().startswith("boundary="):
            value = token.split("=", 1)[1].strip()
            return value.strip('"')
    return None


def _strip_multipart(body: bytes, boundary: str) -> bytes:
    delim = ("--" + boundary).encode()
    parts = body.split(delim)
    for part in parts:
        marker = part.find(b"\r\n\r\n")
        if marker == -1:
            continue
        payload = part[marker + 4 :]
        # Trailing CRLF before the next boundary
        return payload.rstrip(b"\r\n-")
    return body


def _instance_uid(entry: dict) -> str | None:
    value = entry.get("00080018", {}).get("Value")
    if isinstance(value, list) and value:
        return str(value[0])
    return None


async def fetch_series_volume(
    base_url: str, study_uid: str, series_uid: str
) -> LoadedVolume:
    user, pw = dicom_web_credentials()
    auth = httpx.BasicAuth(user, pw) if user and pw else None
    timeout = httpx.Timeout(60.0, connect=15.0)
    sem = asyncio.Semaphore(wado_concurrency())

    async with httpx.AsyncClient(auth=auth, timeout=timeout) as client:
        entries = await _list_instances(client, base_url, study_uid, series_uid)
        uids = [uid for uid in (_instance_uid(e) for e in entries) if uid]
        if not uids:
            raise RuntimeError(
                f"No instances found for series {series_uid} at {base_url}"
            )

        async def _bound(uid: str) -> pydicom.Dataset:
            async with sem:
                return await _fetch_instance(client, base_url, study_uid, series_uid, uid)

        datasets = await asyncio.gather(*[_bound(uid) for uid in uids])

    image = _datasets_to_sitk(datasets)
    modality = str(getattr(datasets[0], "Modality", "")).upper() or "UNKNOWN"
    return LoadedVolume(image=image, modality=modality, instance_count=len(datasets))


def _datasets_to_sitk(datasets: list[pydicom.Dataset]) -> sitk.Image:
    sortable: list[tuple[float, int, pydicom.Dataset]] = []
    for ds in datasets:
        z = _z_position(ds)
        instance = int(getattr(ds, "InstanceNumber", 0) or 0)
        sortable.append((z if z is not None else float(instance), instance, ds))
    sortable.sort(key=lambda t: (t[0], t[1]))
    sorted_ds = [t[2] for t in sortable]

    first = sorted_ds[0]
    rows = int(first.Rows)
    cols = int(first.Columns)
    slope = float(getattr(first, "RescaleSlope", 1.0) or 1.0)
    intercept = float(getattr(first, "RescaleIntercept", 0.0) or 0.0)

    pixel_spacing = [float(v) for v in getattr(first, "PixelSpacing", [1.0, 1.0])]
    spacing_z = _z_spacing(sorted_ds)
    origin = [float(v) for v in getattr(first, "ImagePositionPatient", [0.0, 0.0, 0.0])]
    iop = [float(v) for v in getattr(first, "ImageOrientationPatient", [1, 0, 0, 0, 1, 0])]
    row_dir = np.array(iop[0:3])
    col_dir = np.array(iop[3:6])
    slice_dir = np.cross(row_dir, col_dir)

    volume = np.zeros((len(sorted_ds), rows, cols), dtype=np.float32)
    for idx, ds in enumerate(sorted_ds):
        arr = ds.pixel_array.astype(np.float32)
        slope_i = float(getattr(ds, "RescaleSlope", slope) or slope)
        intercept_i = float(getattr(ds, "RescaleIntercept", intercept) or intercept)
        volume[idx] = arr * slope_i + intercept_i

    image = sitk.GetImageFromArray(volume)
    image.SetSpacing((pixel_spacing[1], pixel_spacing[0], spacing_z))
    image.SetOrigin(tuple(origin))
    image.SetDirection(
        (
            row_dir[0], col_dir[0], slice_dir[0],
            row_dir[1], col_dir[1], slice_dir[1],
            row_dir[2], col_dir[2], slice_dir[2],
        )
    )
    return image


def _z_position(ds: pydicom.Dataset) -> float | None:
    pos = getattr(ds, "ImagePositionPatient", None)
    if pos is None:
        return None
    try:
        return float(pos[2])
    except (TypeError, ValueError, IndexError):
        return None


def _z_spacing(datasets: list[pydicom.Dataset]) -> float:
    if len(datasets) < 2:
        thickness = getattr(datasets[0], "SliceThickness", None)
        try:
            return float(thickness) if thickness is not None else 1.0
        except (TypeError, ValueError):
            return 1.0
    z0 = _z_position(datasets[0]) or 0.0
    z1 = _z_position(datasets[1]) or 1.0
    diff = abs(z1 - z0)
    if diff > 1e-6:
        return diff
    thickness = getattr(datasets[0], "SliceThickness", None)
    try:
        return float(thickness) if thickness is not None else 1.0
    except (TypeError, ValueError):
        return 1.0
