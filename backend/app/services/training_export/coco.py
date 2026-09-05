"""COCO object-detection export."""

from __future__ import annotations

import json
import zipfile
from datetime import datetime
from typing import Any

from ...models import Annotation
from ...utils.time import now_iso
from ._common import DATA_CAPTURE_NOTE
from .identifiers import IDENTIFIED, Identifiers
from .images import image_key

_README = """# COCO Format Dataset for Radiolyze Fine-Tuning

## Structure
```
├── annotations/
│   ├── train.json
│   └── val.json
└── images/  (to be populated with DICOM renders)
```

## Usage with detectron2
```python
from detectron2.data import DatasetCatalog, MetadataCatalog
from detectron2.data.datasets import register_coco_instances

register_coco_instances("radiolyze_train", {}, "annotations/train.json", "images/")
register_coco_instances("radiolyze_val", {}, "annotations/val.json", "images/")
```

## Image Acquisition
Use WADO-RS to fetch rendered images:
```
GET /wado-rs/studies/{study_id}/series/{series_id}/instances/{instance_id}/frames/{frame}/rendered
```
"""


def build_dataset(
    annotations: list[Annotation],
    ids: Identifiers = IDENTIFIED,
) -> dict[str, Any]:
    """Build COCO format dataset from annotations."""
    # Collect unique categories
    category_set = set()
    for ann in annotations:
        category_set.add(ann.category or "other")

    category_map = {cat: idx + 1 for idx, cat in enumerate(sorted(category_set))}

    # Build images list (unique by instance)
    images_map: dict[str, dict] = {}
    for ann in annotations:
        key = image_key(ann, ids)
        if key not in images_map:
            images_map[key] = {
                "id": len(images_map) + 1,
                "file_name": f"{key}.png",
                "width": 512,  # Default, should be from DICOM metadata
                "height": 512,
                "study_id": ids(ann.study_id),
                "series_id": ids(ann.series_id),
                "instance_id": ids(ann.instance_id),
                "frame_index": ann.frame_index,
            }

    # Build annotations list
    coco_annotations = []
    for idx, ann in enumerate(annotations):
        image_id = images_map[image_key(ann, ids)]["id"]

        geometry = ann.geometry_json or {}
        bbox = geometry.get("bounding_box", {})

        # Calculate area from bounding box or handles
        x = bbox.get("x", 0)
        y = bbox.get("y", 0)
        w = bbox.get("width", 50)
        h = bbox.get("height", 50)
        area = w * h

        coco_annotations.append(
            {
                "id": idx + 1,
                "image_id": image_id,
                "category_id": category_map.get(ann.category or "other", 1),
                "bbox": [x, y, w, h],
                "area": area,
                "iscrowd": 0,
                "attributes": {
                    "label": ann.label,
                    "severity": ann.severity,
                    "tool_type": ann.tool_type,
                    "verified": ann.verified_by is not None,
                    "notes": ann.notes,
                },
            }
        )

    return {
        "info": {
            "description": "Radiolyze Training Dataset",
            "version": "1.0",
            "year": datetime.utcnow().year,
            "date_created": now_iso(),
        },
        "licenses": [{"id": 1, "name": "Internal Use Only", "url": ""}],
        "images": list(images_map.values()),
        "annotations": coco_annotations,
        "categories": [
            {"id": cat_id, "name": cat_name, "supercategory": "medical"}
            for cat_name, cat_id in category_map.items()
        ],
    }


def write_dataset(
    zf: zipfile.ZipFile,
    train_annotations: list[Annotation],
    val_annotations: list[Annotation],
    ids: Identifiers = IDENTIFIED,
) -> None:
    # Nothing to scrub after the fact: COCO carries no DICOM metadata block and
    # no actor names, so the identifiers `ids` maps while the dataset is built
    # are the whole of this format's de-identification. What stood here instead
    # was a filter removing `created_by`/`verified_by` from `attributes` --
    # keys `build_dataset` never writes -- which is why COCO used to come out
    # of an anonymized export completely untouched (#329).
    zf.writestr(
        "annotations/train.json", json.dumps(build_dataset(train_annotations, ids), indent=2)
    )
    zf.writestr("annotations/val.json", json.dumps(build_dataset(val_annotations, ids), indent=2))


def readme(include_images: bool) -> str:
    return (_README + DATA_CAPTURE_NOTE) if include_images else _README
