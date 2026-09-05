"""Radiolyze multimodal fine-tuning export (prompt/response pairs + LoRA config)."""

from __future__ import annotations

import json
import zipfile
from typing import Any

from ...anonymize import anonymize_annotation
from ...models import Annotation
from ._common import DATA_CAPTURE_NOTE
from .identifiers import IDENTIFIED, Identifiers
from .images import group_by_image

LORA_CONFIG = {
    "r": 16,
    "lora_alpha": 32,
    "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"],
    "lora_dropout": 0.05,
    "bias": "none",
    "task_type": "CAUSAL_LM",
}

PROMPT = (
    "Describe the findings in this medical image. Identify any abnormalities and their locations."
)

_README = """# Radiolyze Fine-Tuning Dataset

## Format
Each sample contains:
- `image_path`: Path to rendered DICOM image
- `wado_url`: WADO-RS URL for image retrieval
- `prompt`: Input prompt for the model
- `response`: Expected model output (findings description)
- `annotations`: Bounding boxes and labels for detection tasks

## Fine-Tuning with LoRA
```python
import json

import torch
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load model
model = AutoModelForCausalLM.from_pretrained(
    "google/medgemma-1.5-4b-it",
    torch_dtype=torch.bfloat16,
    device_map="auto",
)

# Apply LoRA
with open("lora_config.json") as f:
    lora_config = LoraConfig(**json.load(f))
model = get_peft_model(model, lora_config)

# Load dataset
with open("train.json") as f:
    train_data = json.load(f)

# Train...
```

## Rendering Images
Use the WADO-RS URLs to fetch rendered PNG images before training.
"""


def build_dataset(
    annotations: list[Annotation],
    ids: Identifiers = IDENTIFIED,
) -> list[dict[str, Any]]:
    """Build Radiolyze multimodal fine-tuning format."""
    samples = []

    for image_key, anns in group_by_image(annotations, ids).items():
        first_ann = anns[0]

        # Build findings description from annotations
        findings_parts = []
        for ann in anns:
            severity_text = f" ({ann.severity})" if ann.severity else ""
            location_text = f" in {ann.anatomical_region}" if ann.anatomical_region else ""
            laterality_text = f" {ann.laterality}" if ann.laterality else ""
            findings_parts.append(f"{ann.label}{severity_text}{laterality_text}{location_text}")

        findings_text = (
            ". ".join(findings_parts) + "." if findings_parts else "No significant findings."
        )

        # Build annotation list for training
        annotation_list = []
        for ann in anns:
            geometry = ann.geometry_json or {}
            bbox = geometry.get("bounding_box", {})
            annotation_list.append(
                {
                    "label": ann.label,
                    "category": ann.category,
                    "severity": ann.severity,
                    "bbox": [
                        bbox.get("x", 0),
                        bbox.get("y", 0),
                        bbox.get("width", 50),
                        bbox.get("height", 50),
                    ],
                    "tool_type": ann.tool_type,
                }
            )

        samples.append(
            {
                "id": image_key,
                "image_path": f"images/{image_key}.png",
                "wado_url": (
                    f"/wado-rs/studies/{ids(first_ann.study_id)}"
                    f"/series/{ids(first_ann.series_id)}"
                    f"/instances/{ids(first_ann.instance_id)}"
                    f"/frames/{first_ann.frame_index + 1}/rendered"
                ),
                "prompt": PROMPT,
                "response": findings_text,
                "annotations": annotation_list,
                "metadata": {
                    "study_id": ids(first_ann.study_id),
                    "series_id": ids(first_ann.series_id),
                    "instance_id": ids(first_ann.instance_id),
                    "frame_index": first_ann.frame_index,
                    "modality": "CT",  # Should come from DICOM metadata
                },
            }
        )

    return samples


def write_dataset(
    zf: zipfile.ZipFile,
    train_annotations: list[Annotation],
    val_annotations: list[Annotation],
    ids: Identifiers = IDENTIFIED,
) -> None:
    train_data = build_dataset(train_annotations, ids)
    val_data = build_dataset(val_annotations, ids)
    if ids.anonymize:
        # The frame identifiers -- in the key, the image path, the WADO URL and
        # under `metadata` -- are already mapped above, together, so that all
        # four still agree. What is left for the scrub is the DICOM metadata
        # around them; it used to rebuild the paths here instead, from top-level
        # fields this format does not have, and emptied them (#329).
        train_data = [anonymize_annotation(s) for s in train_data]
        val_data = [anonymize_annotation(s) for s in val_data]

    zf.writestr("train.json", json.dumps(train_data, indent=2))
    zf.writestr("val.json", json.dumps(val_data, indent=2))
    zf.writestr("lora_config.json", json.dumps(LORA_CONFIG, indent=2))


def readme(include_images: bool) -> str:
    return (_README + DATA_CAPTURE_NOTE) if include_images else _README
