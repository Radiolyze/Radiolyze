"""Rendered frames: how they are addressed, listed and fetched.

One rendered frame is identified by ``study/series/instance/frame`` in four
places at once -- the ZIP member name, the COCO ``file_name``, the HuggingFace
``image_id`` and the manifest ``id`` -- so the key is built here and nowhere
else. Two annotations on the same frame are one image, which is what makes the
key a key rather than a formatting detail.
"""

from __future__ import annotations

import base64
import hashlib
import os
from collections.abc import Callable
from typing import Any

import httpx

from ...models import Annotation

#: Called with the manifest path and the fetched bytes for every frame that
#: came back, so the ZIP writer can store what the status pass already read.
ImageSink = Callable[[str, bytes], None]


def image_key(ann: Annotation) -> str:
    """Identify the rendered frame an annotation sits on."""
    return f"{ann.study_id}_{ann.series_id}_{ann.instance_id}_{ann.frame_index}"


def group_by_image(annotations: list[Annotation]) -> dict[str, list[Annotation]]:
    """Group annotations by the frame they sit on, keeping input order."""
    groups: dict[str, list[Annotation]] = {}
    for ann in annotations:
        groups.setdefault(image_key(ann), []).append(ann)
    return groups


def dicom_web_base_url() -> str:
    return os.getenv("DICOM_WEB_BASE_URL", "http://orthanc:8042/dicom-web").rstrip("/")


def dicom_auth_headers() -> dict[str, str]:
    username = os.getenv("DICOM_WEB_USERNAME") or os.getenv("ORTHANC_USERNAME")
    password = os.getenv("DICOM_WEB_PASSWORD") or os.getenv("ORTHANC_PASSWORD")
    if not username or not password:
        return {}
    token = base64.b64encode(f"{username}:{password}".encode()).decode("ascii")
    return {"Authorization": f"Basic {token}"}


def rendered_frame_url(ann: Annotation) -> str:
    frame_number = ann.frame_index + 1
    return (
        f"{dicom_web_base_url()}/studies/{ann.study_id}/series/{ann.series_id}/instances/"
        f"{ann.instance_id}/frames/{frame_number}/rendered"
    )


def collect_image_entries(
    annotations: list[Annotation],
    split: str,
    entries: dict[str, dict[str, Any]],
) -> None:
    """Add the frames these annotations sit on to ``entries``, tagged with ``split``.

    ``entries`` is accumulated across calls: a frame annotated in both halves of
    the split appears once, carrying both split names.
    """
    for ann in annotations:
        key = image_key(ann)
        if key not in entries:
            entries[key] = {
                "id": key,
                "image_path": f"images/{key}.png",
                "wado_url": rendered_frame_url(ann),
                "study_id": ann.study_id,
                "series_id": ann.series_id,
                "instance_id": ann.instance_id,
                "frame_index": ann.frame_index,
                "frame_number": ann.frame_index + 1,
                "splits": set(),
            }
        entries[key]["splits"].add(split)


def build_manifest(entries: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Turn the accumulator into the JSON-serialisable manifest.

    The only real work is the ``splits`` set, which JSON cannot hold.
    """
    manifest: list[dict[str, Any]] = []
    for entry in entries.values():
        splits = sorted(entry.get("splits") or [])
        manifest.append(
            {
                "id": entry["id"],
                "image_path": entry["image_path"],
                "wado_url": entry["wado_url"],
                "study_id": entry["study_id"],
                "series_id": entry["series_id"],
                "instance_id": entry["instance_id"],
                "frame_index": entry["frame_index"],
                "frame_number": entry["frame_number"],
                "splits": splits,
            }
        )
    return manifest


def fetch_manifest_images(
    manifest: list[dict[str, Any]],
    sink: ImageSink | None = None,
) -> dict[str, int]:
    """Fetch every frame in ``manifest``, annotating each entry in place.

    Each entry gains ``status`` and, on success, ``bytes`` and ``sha256``; on
    failure it gains ``error`` instead. Returns the ok/error tally.

    The two callers differ only in what they do with the bytes: the manifest
    preview drops them, the export writes them into the archive. That is the
    ``sink`` -- a frame is never fetched twice to be both counted and stored.
    """
    counts = {"ok": 0, "error": 0}
    headers = dicom_auth_headers()
    with httpx.Client(timeout=20) as client:
        for entry in manifest:
            try:
                response = client.get(entry["wado_url"], headers=headers)
                response.raise_for_status()
                content = response.content
                if sink is not None:
                    sink(entry["image_path"], content)
                entry["status"] = "ok"
                entry["bytes"] = len(content)
                entry["sha256"] = hashlib.sha256(content).hexdigest()
                counts["ok"] += 1
            except Exception as exc:
                entry["status"] = "error"
                entry["error"] = str(exc)
                counts["error"] += 1
    return counts
