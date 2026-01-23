"""Training data export API for Fine-Tuning MedGemma."""

from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import zipfile
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
import httpx

from ..deps import get_db
from ..models import Annotation
from ..utils.time import now_iso

router = APIRouter()

ExportFormat = Literal["coco", "huggingface", "medgemma"]


class ExportRequest(BaseModel):
    format: ExportFormat = "coco"
    study_ids: list[str] | None = Field(default=None, alias="studyIds")
    categories: list[str] | None = None
    verified_only: bool = Field(default=True, alias="verifiedOnly")
    include_images: bool = Field(default=False, alias="includeImages")
    split_ratio: float = Field(default=0.8, alias="splitRatio", ge=0.5, le=0.95)

    class Config:
        populate_by_name = True


class ExportStats(BaseModel):
    total_annotations: int = Field(alias="totalAnnotations")
    verified_annotations: int = Field(alias="verifiedAnnotations")
    categories: dict[str, int]
    studies: int
    series: int

    class Config:
        populate_by_name = True


class ExportResponse(BaseModel):
    export_id: str = Field(alias="exportId")
    format: str
    created_at: str = Field(alias="createdAt")
    stats: ExportStats
    download_url: str = Field(alias="downloadUrl")

    class Config:
        populate_by_name = True


class ManifestRequest(BaseModel):
    study_ids: list[str] | None = Field(default=None, alias="studyIds")
    categories: list[str] | None = None
    verified_only: bool = Field(default=True, alias="verifiedOnly")
    split_ratio: float = Field(default=0.8, alias="splitRatio", ge=0.5, le=0.95)
    limit: int | None = Field(default=None, ge=1, le=20000)
    check_images: bool = Field(default=False, alias="checkImages")

    class Config:
        populate_by_name = True


def _generate_export_id() -> str:
    """Generate unique export ID."""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    hash_suffix = hashlib.md5(str(datetime.utcnow().timestamp()).encode()).hexdigest()[:6]
    return f"export_{timestamp}_{hash_suffix}"


def _dicom_web_base_url() -> str:
    return os.getenv("DICOM_WEB_BASE_URL", "http://orthanc:8042/dicom-web").rstrip("/")


def _dicom_auth_headers() -> dict[str, str]:
    username = os.getenv("DICOM_WEB_USERNAME") or os.getenv("ORTHANC_USERNAME")
    password = os.getenv("DICOM_WEB_PASSWORD") or os.getenv("ORTHANC_PASSWORD")
    if not username or not password:
        return {}
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    return {"Authorization": f"Basic {token}"}


def _build_rendered_frame_url(ann: Annotation) -> str:
    frame_number = ann.frame_index + 1
    return (
        f"{_dicom_web_base_url()}/studies/{ann.study_id}/series/{ann.series_id}/instances/"
        f"{ann.instance_id}/frames/{frame_number}/rendered"
    )


def _collect_image_entries(
    annotations: list[Annotation],
    split: str,
    entries: dict[str, dict[str, Any]],
) -> None:
    for ann in annotations:
        image_key = f"{ann.study_id}_{ann.series_id}_{ann.instance_id}_{ann.frame_index}"
        if image_key not in entries:
            entries[image_key] = {
                "id": image_key,
                "image_path": f"images/{image_key}.png",
                "wado_url": _build_rendered_frame_url(ann),
                "study_id": ann.study_id,
                "series_id": ann.series_id,
                "instance_id": ann.instance_id,
                "frame_index": ann.frame_index,
                "frame_number": ann.frame_index + 1,
                "splits": set(),
            }
        entries[image_key]["splits"].add(split)


def _build_manifest(entries: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
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


def _attach_manifest_status(manifest: list[dict[str, Any]]) -> dict[str, int]:
    headers = _dicom_auth_headers()
    ok_count = 0
    error_count = 0
    with httpx.Client(timeout=20) as client:
        for entry in manifest:
            try:
                response = client.get(entry["wado_url"], headers=headers)
                response.raise_for_status()
                content = response.content
                entry["status"] = "ok"
                entry["bytes"] = len(content)
                entry["sha256"] = hashlib.sha256(content).hexdigest()
                ok_count += 1
            except Exception as exc:
                entry["status"] = "error"
                entry["error"] = str(exc)
                error_count += 1
    return {"ok": ok_count, "error": error_count}


def _build_coco_dataset(annotations: list[Annotation]) -> dict[str, Any]:
    """Build COCO format dataset from annotations."""
    # Collect unique categories
    category_set = set()
    for ann in annotations:
        category_set.add(ann.category or "other")
    
    category_map = {cat: idx + 1 for idx, cat in enumerate(sorted(category_set))}
    
    # Build images list (unique by instance)
    images_map: dict[str, dict] = {}
    for ann in annotations:
        image_key = f"{ann.study_id}_{ann.series_id}_{ann.instance_id}_{ann.frame_index}"
        if image_key not in images_map:
            images_map[image_key] = {
                "id": len(images_map) + 1,
                "file_name": f"{image_key}.png",
                "width": 512,  # Default, should be from DICOM metadata
                "height": 512,
                "study_id": ann.study_id,
                "series_id": ann.series_id,
                "instance_id": ann.instance_id,
                "frame_index": ann.frame_index,
            }
    
    # Build annotations list
    coco_annotations = []
    for idx, ann in enumerate(annotations):
        image_key = f"{ann.study_id}_{ann.series_id}_{ann.instance_id}_{ann.frame_index}"
        image_id = images_map[image_key]["id"]
        
        geometry = ann.geometry_json or {}
        bbox = geometry.get("bounding_box", {})
        
        # Calculate area from bounding box or handles
        x = bbox.get("x", 0)
        y = bbox.get("y", 0)
        w = bbox.get("width", 50)
        h = bbox.get("height", 50)
        area = w * h
        
        coco_annotations.append({
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
        })
    
    return {
        "info": {
            "description": "MedGemma Training Dataset",
            "version": "1.0",
            "year": datetime.utcnow().year,
            "date_created": now_iso(),
        },
        "licenses": [
            {"id": 1, "name": "Internal Use Only", "url": ""}
        ],
        "images": list(images_map.values()),
        "annotations": coco_annotations,
        "categories": [
            {"id": cat_id, "name": cat_name, "supercategory": "medical"}
            for cat_name, cat_id in category_map.items()
        ],
    }


def _build_huggingface_dataset(annotations: list[Annotation]) -> list[dict[str, Any]]:
    """Build HuggingFace datasets format."""
    samples = []
    
    # Group by image
    image_groups: dict[str, list[Annotation]] = {}
    for ann in annotations:
        image_key = f"{ann.study_id}_{ann.series_id}_{ann.instance_id}_{ann.frame_index}"
        if image_key not in image_groups:
            image_groups[image_key] = []
        image_groups[image_key].append(ann)
    
    for image_key, anns in image_groups.items():
        first_ann = anns[0]
        
        # Build objects list
        objects = []
        for ann in anns:
            geometry = ann.geometry_json or {}
            bbox = geometry.get("bounding_box", {})
            objects.append({
                "bbox": [
                    bbox.get("x", 0),
                    bbox.get("y", 0),
                    bbox.get("x", 0) + bbox.get("width", 50),
                    bbox.get("y", 0) + bbox.get("height", 50),
                ],
                "category": ann.category or "other",
                "label": ann.label,
                "severity": ann.severity,
            })
        
        samples.append({
            "image_id": image_key,
            "image_path": f"images/{image_key}.png",
            "study_id": first_ann.study_id,
            "series_id": first_ann.series_id,
            "instance_id": first_ann.instance_id,
            "frame_index": first_ann.frame_index,
            "objects": objects,
            "num_objects": len(objects),
        })
    
    return samples


def _build_medgemma_dataset(annotations: list[Annotation]) -> list[dict[str, Any]]:
    """Build MedGemma multimodal fine-tuning format."""
    samples = []
    
    # Group by image
    image_groups: dict[str, list[Annotation]] = {}
    for ann in annotations:
        image_key = f"{ann.study_id}_{ann.series_id}_{ann.instance_id}_{ann.frame_index}"
        if image_key not in image_groups:
            image_groups[image_key] = []
        image_groups[image_key].append(ann)
    
    for image_key, anns in image_groups.items():
        first_ann = anns[0]
        
        # Build findings description from annotations
        findings_parts = []
        for ann in anns:
            severity_text = f" ({ann.severity})" if ann.severity else ""
            location_text = f" in {ann.anatomical_region}" if ann.anatomical_region else ""
            laterality_text = f" {ann.laterality}" if ann.laterality else ""
            findings_parts.append(
                f"{ann.label}{severity_text}{laterality_text}{location_text}"
            )
        
        findings_text = ". ".join(findings_parts) + "." if findings_parts else "No significant findings."
        
        # Build annotation list for training
        annotation_list = []
        for ann in anns:
            geometry = ann.geometry_json or {}
            bbox = geometry.get("bounding_box", {})
            annotation_list.append({
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
            })
        
        samples.append({
            "id": image_key,
            "image_path": f"images/{image_key}.png",
            "wado_url": f"/wado-rs/studies/{first_ann.study_id}/series/{first_ann.series_id}/instances/{first_ann.instance_id}/frames/{first_ann.frame_index + 1}/rendered",
            "prompt": "Describe the findings in this medical image. Identify any abnormalities and their locations.",
            "response": findings_text,
            "annotations": annotation_list,
            "metadata": {
                "study_id": first_ann.study_id,
                "series_id": first_ann.series_id,
                "instance_id": first_ann.instance_id,
                "frame_index": first_ann.frame_index,
                "modality": "CT",  # Should come from DICOM metadata
            },
        })
    
    return samples


def _create_export_zip(
    export_format: ExportFormat,
    annotations: list[Annotation],
    split_ratio: float,
    include_images: bool,
) -> bytes:
    """Create ZIP file with exported dataset."""
    buffer = io.BytesIO()
    
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Split into train/val
        split_idx = int(len(annotations) * split_ratio)
        train_anns = annotations[:split_idx]
        val_anns = annotations[split_idx:]
        image_entries: dict[str, dict[str, Any]] = {}
        if include_images:
            _collect_image_entries(train_anns, "train", image_entries)
            _collect_image_entries(val_anns, "val", image_entries)
        
        if export_format == "coco":
            # COCO format
            train_data = _build_coco_dataset(train_anns)
            val_data = _build_coco_dataset(val_anns)
            
            zf.writestr(
                "annotations/train.json",
                json.dumps(train_data, indent=2),
            )
            zf.writestr(
                "annotations/val.json",
                json.dumps(val_data, indent=2),
            )
            
            # Add README
            readme = """# COCO Format Dataset for MedGemma Fine-Tuning

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

register_coco_instances("medgemma_train", {}, "annotations/train.json", "images/")
register_coco_instances("medgemma_val", {}, "annotations/val.json", "images/")
```

## Image Acquisition
Use WADO-RS to fetch rendered images:
```
GET /wado-rs/studies/{study_id}/series/{series_id}/instances/{instance_id}/frames/{frame}/rendered
```
"""
            if include_images:
                readme += """

## Data Capture
Dieses Exportpaket enthaelt bereits gerenderte PNGs in `images/`
und ein `images/manifest.json` mit Metadaten/Hashes.
"""
            zf.writestr("README.md", readme)
            
        elif export_format == "huggingface":
            # HuggingFace datasets format
            train_data = _build_huggingface_dataset(train_anns)
            val_data = _build_huggingface_dataset(val_anns)
            
            zf.writestr(
                "data/train.jsonl",
                "\n".join(json.dumps(s) for s in train_data),
            )
            zf.writestr(
                "data/val.jsonl",
                "\n".join(json.dumps(s) for s in val_data),
            )
            
            # Dataset info
            dataset_info = {
                "description": "MedGemma Medical Imaging Dataset",
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
            
            readme = """# HuggingFace Dataset for MedGemma Fine-Tuning

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
            if include_images:
                readme += """

## Data Capture
Dieses Exportpaket enthaelt gerenderte PNGs in `images/` und ein
`images/manifest.json` mit Metadaten/Hashes.
"""
            zf.writestr("README.md", readme)
            
        elif export_format == "medgemma":
            # MedGemma multimodal format
            train_data = _build_medgemma_dataset(train_anns)
            val_data = _build_medgemma_dataset(val_anns)
            
            zf.writestr(
                "train.json",
                json.dumps(train_data, indent=2),
            )
            zf.writestr(
                "val.json",
                json.dumps(val_data, indent=2),
            )
            
            # LoRA fine-tuning config
            lora_config = {
                "r": 16,
                "lora_alpha": 32,
                "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"],
                "lora_dropout": 0.05,
                "bias": "none",
                "task_type": "CAUSAL_LM",
            }
            zf.writestr("lora_config.json", json.dumps(lora_config, indent=2))
            
            readme = """# MedGemma 1.5 Fine-Tuning Dataset

## Format
Each sample contains:
- `image_path`: Path to rendered DICOM image
- `wado_url`: WADO-RS URL for image retrieval
- `prompt`: Input prompt for the model
- `response`: Expected model output (findings description)
- `annotations`: Bounding boxes and labels for detection tasks

## Fine-Tuning with LoRA
```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model
import json

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
            if include_images:
                readme += """

## Data Capture
Dieses Exportpaket enthaelt gerenderte PNGs in `images/` und ein
`images/manifest.json` mit Metadaten/Hashes.
"""
            zf.writestr("README.md", readme)

        if include_images and image_entries:
            manifest = _build_manifest(image_entries)
            headers = _dicom_auth_headers()
            status_counts = {"ok": 0, "error": 0}
            with httpx.Client(timeout=20) as client:
                for entry in manifest:
                    try:
                        response = client.get(entry["wado_url"], headers=headers)
                        response.raise_for_status()
                        content = response.content
                        zf.writestr(entry["image_path"], content)
                        entry["status"] = "ok"
                        entry["bytes"] = len(content)
                        entry["sha256"] = hashlib.sha256(content).hexdigest()
                        status_counts["ok"] += 1
                    except Exception as exc:
                        entry["status"] = "error"
                        entry["error"] = str(exc)
                        status_counts["error"] += 1
            zf.writestr(
                "images/manifest.json",
                json.dumps({"images": manifest, "status": status_counts}, indent=2),
            )
    
    buffer.seek(0)
    return buffer.read()


@router.get("/api/v1/training/stats", response_model=ExportStats)
def get_training_stats(
    study_ids: str | None = Query(default=None, alias="studyIds"),
    verified_only: bool = Query(default=False, alias="verifiedOnly"),
    db: Session = Depends(get_db),
) -> ExportStats:
    """Get annotation statistics for training."""
    query = db.query(Annotation)
    
    if study_ids:
        ids = [s.strip() for s in study_ids.split(",")]
        query = query.filter(Annotation.study_id.in_(ids))
    
    if verified_only:
        query = query.filter(Annotation.verified_by.isnot(None))
    
    annotations = query.all()
    
    # Count categories
    categories: dict[str, int] = {}
    studies = set()
    series = set()
    verified_count = 0
    
    for ann in annotations:
        cat = ann.category or "other"
        categories[cat] = categories.get(cat, 0) + 1
        studies.add(ann.study_id)
        series.add(f"{ann.study_id}_{ann.series_id}")
        if ann.verified_by:
            verified_count += 1
    
    return ExportStats(
        totalAnnotations=len(annotations),
        verifiedAnnotations=verified_count,
        categories=categories,
        studies=len(studies),
        series=len(series),
    )


@router.post("/api/v1/training/export")
def export_training_data(
    payload: ExportRequest,
    db: Session = Depends(get_db),
):
    """Export annotations in specified format."""
    query = db.query(Annotation)
    
    if payload.study_ids:
        query = query.filter(Annotation.study_id.in_(payload.study_ids))
    
    if payload.categories:
        query = query.filter(Annotation.category.in_(payload.categories))
    
    if payload.verified_only:
        query = query.filter(Annotation.verified_by.isnot(None))
    
    annotations = query.order_by(Annotation.created_at).all()
    
    if not annotations:
        raise HTTPException(status_code=400, detail="No annotations found matching criteria")
    
    # Create ZIP file
    zip_content = _create_export_zip(
        payload.format,
        annotations,
        payload.split_ratio,
        payload.include_images,
    )
    
    export_id = _generate_export_id()
    filename = f"{export_id}_{payload.format}.zip"
    
    return StreamingResponse(
        io.BytesIO(zip_content),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/api/v1/training/manifest")
def export_manifest(
    payload: ManifestRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Preview manifest entries for data capture."""
    query = db.query(Annotation)

    if payload.study_ids:
        query = query.filter(Annotation.study_id.in_(payload.study_ids))

    if payload.categories:
        query = query.filter(Annotation.category.in_(payload.categories))

    if payload.verified_only:
        query = query.filter(Annotation.verified_by.isnot(None))

    annotations = query.order_by(Annotation.created_at).all()
    if not annotations:
        raise HTTPException(status_code=400, detail="No annotations found matching criteria")

    split_idx = int(len(annotations) * payload.split_ratio)
    train_anns = annotations[:split_idx]
    val_anns = annotations[split_idx:]
    image_entries: dict[str, dict[str, Any]] = {}
    _collect_image_entries(train_anns, "train", image_entries)
    _collect_image_entries(val_anns, "val", image_entries)
    manifest = _build_manifest(image_entries)
    total = len(manifest)
    if payload.limit:
        manifest = manifest[: payload.limit]

    status_counts = None
    if payload.check_images:
        status_counts = _attach_manifest_status(manifest)

    response: dict[str, Any] = {"total": total, "images": manifest}
    if status_counts is not None:
        response["status"] = status_counts
    return response


@router.get("/api/v1/training/categories")
def list_annotation_categories(
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List all annotation categories with counts."""
    results = (
        db.query(Annotation.category, func.count(Annotation.id))
        .group_by(Annotation.category)
        .all()
    )
    
    return [
        {"category": cat or "other", "count": count}
        for cat, count in results
    ]
