"""Training-data export: the dataset formats and the archive around them.

Split out of ``app/api/training.py`` (#293), which held the three dataset
builders, the ZIP writer, the rendered-frame fetch and their README templates
alongside four route handlers.

- ``coco`` / ``huggingface`` / ``radiolyze`` -- one module per export format,
  each owning its dataset shape *and* the README that documents it, so the
  archive's on-disk contract is readable in one place.
- ``images`` -- how a rendered frame is addressed, listed in the manifest and
  fetched over DICOMweb. Shared by the export and the manifest preview, and the
  one place an anonymized export turns DICOM identifiers into pseudonyms (#329):
  the formats build every key, path and URL from what ``frame_ids`` hands them.
- ``archive`` -- the split, the ZIP and the parts every format has in common.

``app.api.training`` keeps the HTTP surface only: the request/response schemas,
the query filters and the ``StreamingResponse``.
"""

from __future__ import annotations

from ._common import ExportFormat
from .archive import build_export_zip
from .images import (
    build_manifest,
    collect_image_entries,
    fetch_manifest_images,
    fetch_urls,
    frame_ids,
    frame_key,
    group_by_image,
    image_key,
    rendered_frame_url,
    wado_rs_path,
)

__all__ = [
    "ExportFormat",
    "build_export_zip",
    "build_manifest",
    "collect_image_entries",
    "fetch_manifest_images",
    "fetch_urls",
    "frame_ids",
    "frame_key",
    "group_by_image",
    "image_key",
    "rendered_frame_url",
    "wado_rs_path",
]
