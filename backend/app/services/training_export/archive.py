"""Assemble the export ZIP: split, dataset files, README, rendered frames."""

from __future__ import annotations

import io
import json
import zipfile
from typing import Any, Protocol

from ...models import Annotation
from . import coco, huggingface, radiolyze
from ._common import ExportFormat
from .identifiers import Identifiers, id_map
from .images import build_manifest, collect_image_entries, fetch_manifest_images


class _WriteDataset(Protocol):
    def __call__(
        self,
        zf: zipfile.ZipFile,
        train_annotations: list[Annotation],
        val_annotations: list[Annotation],
        ids: Identifiers,
    ) -> None: ...


class _Readme(Protocol):
    def __call__(self, include_images: bool) -> str: ...


#: What each format contributes. Everything else about the archive -- the
#: train/val split, the README member, the rendered frames and their manifest
#: -- is the same for all three and lives below.
_FORMATS: dict[ExportFormat, tuple[_WriteDataset, _Readme]] = {
    "coco": (coco.write_dataset, coco.readme),
    "huggingface": (huggingface.write_dataset, huggingface.readme),
    "radiolyze": (radiolyze.write_dataset, radiolyze.readme),
}


def build_export_zip(
    export_format: ExportFormat,
    annotations: list[Annotation],
    split_ratio: float,
    include_images: bool,
    anonymize: bool = True,
) -> bytes:
    """Create ZIP file with exported dataset."""
    try:
        write_dataset, readme = _FORMATS[export_format]
    except KeyError:  # pragma: no cover - the route validates against ExportFormat
        raise ValueError(f"Unsupported export format: {export_format}") from None

    split_idx = int(len(annotations) * split_ratio)
    train_anns = annotations[:split_idx]
    val_anns = annotations[split_idx:]

    # The one place the `anonymize` flag turns into a decision. Every identifier
    # in the archive -- dataset files, image members and manifest alike -- is
    # written through this mapping, which is what keeps them pointing at each
    # other whichever way the flag is set.
    ids = id_map(anonymize)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        write_dataset(zf, train_anns, val_anns, ids)
        zf.writestr("README.md", readme(include_images))

        if include_images:
            _write_images(zf, train_anns, val_anns, ids)

    buffer.seek(0)
    return buffer.read()


def _write_images(
    zf: zipfile.ZipFile,
    train_annotations: list[Annotation],
    val_annotations: list[Annotation],
    ids: Identifiers,
) -> None:
    """Fetch every annotated frame into the archive, next to its manifest."""
    entries: dict[str, dict[str, Any]] = {}
    collect_image_entries(train_annotations, "train", entries, ids)
    collect_image_entries(val_annotations, "val", entries, ids)
    if not entries:
        return

    # Fetch first, then publish: the entries carry the real frame URL, which the
    # fetch needs and the manifest must not repeat. `build_manifest` picks the
    # per-frame results up off the entries afterwards.
    status_counts = fetch_manifest_images(list(entries.values()), zf.writestr)
    zf.writestr(
        "images/manifest.json",
        json.dumps({"images": build_manifest(entries), "status": status_counts}, indent=2),
    )
