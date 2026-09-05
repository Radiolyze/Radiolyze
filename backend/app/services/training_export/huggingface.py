"""HuggingFace ``datasets`` export (one JSONL row per frame)."""

from __future__ import annotations

import json
import zipfile
from typing import Any

from ...anonymize import anonymize_annotation
from ...models import Annotation
from ._common import DATA_CAPTURE_NOTE
from .images import group_by_image

_README = """# HuggingFace Dataset for Radiolyze Fine-Tuning

## Loading
```python
from datasets import load_dataset

dataset = load_dataset("json", data_files={
    "train": "data/train.jsonl",
    "validation": "data/val.jsonl",
})
```

## Fine-Tuning with transformers
```python
from transformers import AutoModelForObjectDetection, TrainingArguments, Trainer

model = AutoModelForObjectDetection.from_pretrained("google/medgemma-1.5-4b-it")
# ... configure training
```
"""


def build_dataset(annotations: list[Annotation]) -> list[dict[str, Any]]:
    """Build HuggingFace datasets format."""
    samples = []

    for image_key, anns in group_by_image(annotations).items():
        first_ann = anns[0]

        # Build objects list
        objects = []
        for ann in anns:
            geometry = ann.geometry_json or {}
            bbox = geometry.get("bounding_box", {})
            objects.append(
                {
                    "bbox": [
                        bbox.get("x", 0),
                        bbox.get("y", 0),
                        bbox.get("x", 0) + bbox.get("width", 50),
                        bbox.get("y", 0) + bbox.get("height", 50),
                    ],
                    "category": ann.category or "other",
                    "label": ann.label,
                    "severity": ann.severity,
                }
            )

        samples.append(
            {
                "image_id": image_key,
                "image_path": f"images/{image_key}.png",
                "study_id": first_ann.study_id,
                "series_id": first_ann.series_id,
                "instance_id": first_ann.instance_id,
                "frame_index": first_ann.frame_index,
                "objects": objects,
                "num_objects": len(objects),
            }
        )

    return samples


def write_dataset(
    zf: zipfile.ZipFile,
    train_annotations: list[Annotation],
    val_annotations: list[Annotation],
    anonymize: bool,
) -> None:
    train_data = build_dataset(train_annotations)
    val_data = build_dataset(val_annotations)
    if anonymize:
        train_data = [anonymize_annotation(s) for s in train_data]
        val_data = [anonymize_annotation(s) for s in val_data]

    zf.writestr("data/train.jsonl", "\n".join(json.dumps(s) for s in train_data))
    zf.writestr("data/val.jsonl", "\n".join(json.dumps(s) for s in val_data))

    dataset_info = {
        "description": "Radiolyze Medical Imaging Dataset",
        "features": {
            "image_id": {"dtype": "string"},
            "image_path": {"dtype": "string"},
            "study_id": {"dtype": "string"},
            "series_id": {"dtype": "string"},
            "objects": {"dtype": "list"},
        },
        "splits": {
            "train": {"num_examples": len(train_data)},
            "validation": {"num_examples": len(val_data)},
        },
    }
    zf.writestr("dataset_info.json", json.dumps(dataset_info, indent=2))


def readme(include_images: bool) -> str:
    return (_README + DATA_CAPTURE_NOTE) if include_images else _README
