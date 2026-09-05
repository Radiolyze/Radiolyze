"""COCO object-detection export."""

from __future__ import annotations

import json
import zipfile
from datetime import datetime
from typing import Any

from ...models import Annotation
from ...utils.time import now_iso
from ._common import DATA_CAPTURE_NOTE
from .images import frame_ids, frame_key, image_key

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


def build_dataset(annotations: list[Annotation], anonymize: bool = False) -> dict[str, Any]:
    """Build COCO format dataset from annotations."""
    # Collect unique categories
    category_set = set()
    for ann in annotations:
        category_set.add(ann.category or "other")

    category_map = {cat: idx + 1 for idx, cat in enumerate(sorted(category_set))}

    # Build images list (unique by instance). Grouped by the raw key so that the
    # grouping is the same either way; exported under the key `anonymize` gives.
    images_map: dict[str, dict] = {}
    for ann in annotations:
        key = image_key(ann)
        if key not in images_map:
            study_id, series_id, instance_id, frame_index = frame_ids(ann, anonymize=anonymize)
            images_map[key] = {
                "id": len(images_map) + 1,
                "file_name": f"{frame_key(study_id, series_id, instance_id, frame_index)}.png",
                "width": 512,  # Default, should be from DICOM metadata
                "height": 512,
                "study_id": study_id,
                "series_id": series_id,
                "instance_id": instance_id,
                "frame_index": frame_index,
            }

    # Build annotations list
    coco_annotations = []
    for idx, ann in enumerate(annotations):
        image_id = images_map[image_key(ann)]["id"]

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
    anonymize: bool,
) -> None:
    train_data = build_dataset(train_annotations, anonymize)
    val_data = build_dataset(val_annotations, anonymize)

    zf.writestr("annotations/train.json", json.dumps(train_data, indent=2))
    zf.writestr("annotations/val.json", json.dumps(val_data, indent=2))


def readme(include_images: bool) -> str:
    return (_README + DATA_CAPTURE_NOTE) if include_images else _README
