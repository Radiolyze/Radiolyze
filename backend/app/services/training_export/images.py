"""Rendered frames: how they are addressed, listed and fetched.

One rendered frame is identified by ``study/series/instance/frame`` in four
places at once -- the ZIP member name, the COCO ``file_name``, the HuggingFace
``image_id`` and the manifest ``id`` -- so the key is built here and nowhere
else. Two annotations on the same frame are one image, which is what makes the
key a key rather than a formatting detail.

Because the key is built from the identifiers, it is also where an anonymized
export would otherwise carry them straight back out. Every function that writes
an identifier therefore takes an ``Identifiers`` mapping and applies it; the one
exception is the URL a frame is *fetched* over, which has to keep addressing the
real study, series and instance or nothing comes back.
"""

from __future__ import annotations

import base64
import hashlib
import os
from collections.abc import Callable
from typing import Any

import httpx

from ...models import Annotation
from .identifiers import IDENTIFIED, Identifiers

#: Called with the manifest path and the fetched bytes for every frame that
#: came back, so the ZIP writer can store what the status pass already read.
ImageSink = Callable[[str, bytes], None]


def image_key(ann: Annotation, ids: Identifiers = IDENTIFIED) -> str:
    """Identify the rendered frame an annotation sits on."""
    return f"{ids(ann.study_id)}_{ids(ann.series_id)}_{ids(ann.instance_id)}_{ann.frame_index}"


def group_by_image(
    annotations: list[Annotation],
    ids: Identifiers = IDENTIFIED,
) -> dict[str, list[Annotation]]:
    """Group annotations by the frame they sit on, keeping input order."""
    groups: dict[str, list[Annotation]] = {}
    for ann in annotations:
        groups.setdefault(image_key(ann, ids), []).append(ann)
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


def rendered_frame_url(ann: Annotation, ids: Identifiers = IDENTIFIED) -> str:
    frame_number = ann.frame_index + 1
    return (
        f"{dicom_web_base_url()}/studies/{ids(ann.study_id)}/series/{ids(ann.series_id)}/instances/"
        f"{ids(ann.instance_id)}/frames/{frame_number}/rendered"
    )


def collect_image_entries(
    annotations: list[Annotation],
    split: str,
    entries: dict[str, dict[str, Any]],
    ids: Identifiers = IDENTIFIED,
) -> None:
    """Add the frames these annotations sit on to ``entries``, tagged with ``split``.

    ``entries`` is accumulated across calls: a frame annotated in both halves of
    the split appears once, carrying both split names.

    Every identifier here is written through ``ids``, including the ZIP member
    name under ``image_path`` -- an archive whose dataset files are anonymized
    but whose image members are still named after the real study would leak them
    just the same, and would not line up with the paths the dataset points at.
    ``fetch_url`` is the exception and stays real: it is what the frame is
    actually retrieved over, and it never reaches the archive.
    """
    for ann in annotations:
        key = image_key(ann, ids)
        if key not in entries:
            entries[key] = {
                "id": key,
                "image_path": f"images/{key}.png",
                "wado_url": rendered_frame_url(ann, ids),
                "fetch_url": rendered_frame_url(ann),
                "study_id": ids(ann.study_id),
                "series_id": ids(ann.series_id),
                "instance_id": ids(ann.instance_id),
                "frame_index": ann.frame_index,
                "frame_number": ann.frame_index + 1,
                "splits": set(),
            }
        entries[key]["splits"].add(split)


#: Copied onto a manifest record once its frame has been fetched. The export
#: fetches before it writes the manifest, the preview after, so these are
#: carried through when present rather than assumed either way.
_FETCH_RESULT_FIELDS = ("status", "bytes", "sha256", "error")


def build_manifest(entries: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Turn the accumulator into the JSON-serialisable manifest.

    Two things happen here: the ``splits`` set becomes a sorted list, which JSON
    can hold, and ``fetch_url`` is dropped. The field list is a whitelist for
    that second reason -- it is the last point before the manifest is written
    into an archive that may be anonymized, and the real frame URL must not
    travel with it.
    """
    manifest: list[dict[str, Any]] = []
    for entry in entries.values():
        splits = sorted(entry.get("splits") or [])
        record = {
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
        record.update({f: entry[f] for f in _FETCH_RESULT_FIELDS if f in entry})
        manifest.append(record)
    return manifest


def fetch_manifest_images(
    records: list[dict[str, Any]],
    sink: ImageSink | None = None,
) -> dict[str, int]:
    """Fetch every frame in ``records``, annotating each one in place.

    Each record gains ``status`` and, on success, ``bytes`` and ``sha256``; on
    failure it gains ``error`` instead. Returns the ok/error tally.

    The two callers differ only in what they do with the bytes: the manifest
    preview drops them, the export writes them into the archive. That is the
    ``sink`` -- a frame is never fetched twice to be both counted and stored.

    They also differ in what they hand over. The export passes its internal
    entries, which carry a ``fetch_url`` addressing the real frame even when the
    archive around them is anonymized; the preview passes the published manifest,
    where the one URL is the real one because the preview does not anonymize.
    """
    counts = {"ok": 0, "error": 0}
    headers = dicom_auth_headers()
    with httpx.Client(timeout=20) as client:
        for entry in records:
            try:
                response = client.get(entry.get("fetch_url") or entry["wado_url"], headers=headers)
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
