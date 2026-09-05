"""Rendered frames: how they are addressed, listed and fetched.

One rendered frame is identified by ``study/series/instance/frame`` in four
places at once -- the ZIP member name, the COCO ``file_name``, the HuggingFace
``image_id`` and the manifest ``id`` -- so the key is built here and nowhere
else. Two annotations on the same frame are one image, which is what makes the
key a key rather than a formatting detail.

Because the key *is* the identifier, this is also where an anonymized export
stops carrying DICOM identifiers: :func:`frame_ids` pseudonymizes the triple
once, and every key, path and URL downstream is built from what it returns
(#329). A format never pseudonymizes on its own, so the key and the ``study_id``
field beside it cannot drift apart.
"""

from __future__ import annotations

import base64
import hashlib
import os
from collections.abc import Callable
from typing import Any

import httpx

from ...anonymize import pseudonymize
from ...models import Annotation

#: Called with the manifest path and the fetched bytes for every frame that
#: came back, so the ZIP writer can store what the status pass already read.
ImageSink = Callable[[str, bytes], None]


def frame_ids(ann: Annotation, *, anonymize: bool = False) -> tuple[str, str, str, int]:
    """The study/series/instance/frame an annotation sits on, optionally pseudonymized.

    The one place raw DICOM identifiers turn into pseudonyms for an export.
    """
    if anonymize:
        return (
            pseudonymize(ann.study_id),
            pseudonymize(ann.series_id),
            pseudonymize(ann.instance_id),
            ann.frame_index,
        )
    return (ann.study_id, ann.series_id, ann.instance_id, ann.frame_index)


def frame_key(study_id: str, series_id: str, instance_id: str, frame_index: int) -> str:
    """The key a frame is filed under, from whichever ids it is exported with."""
    return f"{study_id}_{series_id}_{instance_id}_{frame_index}"


def image_key(ann: Annotation, *, anonymize: bool = False) -> str:
    """Identify the rendered frame an annotation sits on."""
    return frame_key(*frame_ids(ann, anonymize=anonymize))


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


def _frame_path(study_id: str, series_id: str, instance_id: str, frame_index: int) -> str:
    """The DICOMweb path of a rendered frame, without a host or a prefix.

    Frame numbers are 1-based, frame indices are not; the ``+ 1`` lives here so
    that no caller has to remember it.
    """
    return (
        f"studies/{study_id}/series/{series_id}/instances/{instance_id}"
        f"/frames/{frame_index + 1}/rendered"
    )


def rendered_frame_url(study_id: str, series_id: str, instance_id: str, frame_index: int) -> str:
    """The absolute DICOMweb URL a frame is fetched from."""
    return f"{dicom_web_base_url()}/{_frame_path(study_id, series_id, instance_id, frame_index)}"


def wado_rs_path(study_id: str, series_id: str, instance_id: str, frame_index: int) -> str:
    """The relative WADO-RS reference an exported dataset hands to its consumer."""
    return f"/wado-rs/{_frame_path(study_id, series_id, instance_id, frame_index)}"


def collect_image_entries(
    annotations: list[Annotation],
    split: str,
    entries: dict[str, dict[str, Any]],
    *,
    anonymize: bool = False,
) -> None:
    """Add the frames these annotations sit on to ``entries``, tagged with ``split``.

    ``entries`` is accumulated across calls: a frame annotated in both halves of
    the split appears once, carrying both split names.

    Under ``anonymize`` every published field carries pseudonyms, so the entry
    can no longer be fetched from. The real URL is kept alongside as
    ``source_url``, which :func:`build_manifest` does not publish and
    :func:`fetch_manifest_images` reads via :func:`fetch_urls`.
    """
    for ann in annotations:
        key = image_key(ann, anonymize=anonymize)
        if key not in entries:
            study_id, series_id, instance_id, frame_index = frame_ids(ann, anonymize=anonymize)
            entries[key] = {
                "id": key,
                "image_path": f"images/{key}.png",
                "wado_url": rendered_frame_url(study_id, series_id, instance_id, frame_index),
                "source_url": rendered_frame_url(*frame_ids(ann)),
                "study_id": study_id,
                "series_id": series_id,
                "instance_id": instance_id,
                "frame_index": frame_index,
                "frame_number": frame_index + 1,
                "splits": set(),
            }
        entries[key]["splits"].add(split)


def fetch_urls(entries: dict[str, dict[str, Any]]) -> dict[str, str]:
    """Map each entry id to the URL its frame is actually fetched from."""
    return {entry["id"]: entry["source_url"] for entry in entries.values()}


def build_manifest(entries: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Turn the accumulator into the JSON-serialisable manifest.

    The fields are listed rather than copied: ``splits`` is a set, which JSON
    cannot hold, and ``source_url`` is the un-anonymized URL, which the manifest
    must not carry into the archive.
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
    source_urls: dict[str, str] | None = None,
) -> dict[str, int]:
    """Fetch every frame in ``manifest``, annotating each entry in place.

    Each entry gains ``status`` and, on success, ``bytes`` and ``sha256``; on
    failure it gains ``error`` instead. Returns the ok/error tally.

    The two callers differ only in what they do with the bytes: the manifest
    preview drops them, the export writes them into the archive. That is the
    ``sink`` -- a frame is never fetched twice to be both counted and stored.

    ``source_urls`` (see :func:`fetch_urls`) says where an entry is really
    fetched from. An anonymized manifest publishes a URL built from pseudonyms,
    which no PACS can answer; without the map the entry's own URL is used.
    """
    counts = {"ok": 0, "error": 0}
    headers = dicom_auth_headers()
    urls = source_urls or {}
    with httpx.Client(timeout=20) as client:
        for entry in manifest:
            try:
                response = client.get(urls.get(entry["id"], entry["wado_url"]), headers=headers)
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
