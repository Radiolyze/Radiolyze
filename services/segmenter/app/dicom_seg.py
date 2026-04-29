"""DICOM Segmentation (SEG) writer.

Converts our list of `LabeledMask` artefacts into a single multi-class
DICOM SEG object that references the original CT slices by SOP Instance
UID, so a PACS viewer can overlay the segmentation back on the source
study without any external bookkeeping.

We use ``pydicom-seg`` (Apache-2.0). The lazy import keeps service startup
fast and the unit tests fast — pydicom-seg requires pydicom < 3.0, which
is pinned in the segmenter's `requirements.txt`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pydicom
import SimpleITK as sitk

from .labels import LabeledMask

logger = logging.getLogger(__name__)


class DicomSegUnavailable(RuntimeError):
    """Raised when pydicom-seg is missing or incompatible."""


_writer_factory: Callable[..., Any] | None = None
_template_factory: Callable[..., Any] | None = None


def _resolve_pydicom_seg() -> tuple[Callable[..., Any], Callable[..., Any]]:
    global _writer_factory, _template_factory
    if _writer_factory and _template_factory:
        return _writer_factory, _template_factory
    try:
        import pydicom_seg  # type: ignore
        from pydicom_seg.template import from_dcmqi_metainfo  # type: ignore
    except Exception as exc:  # noqa: BLE001
        raise DicomSegUnavailable(
            "pydicom-seg is not installed in this image. Rebuild the segmenter "
            "with the M4 requirements to enable DICOM SEG export."
        ) from exc
    _writer_factory = pydicom_seg.MultiClassWriter
    _template_factory = from_dcmqi_metainfo
    return _writer_factory, _template_factory


def _set_writer_for_testing(
    writer_factory: Callable[..., Any] | None,
    template_factory: Callable[..., Any] | None = None,
) -> None:
    """Test hook: inject fakes so unit tests run without pydicom-seg."""
    global _writer_factory, _template_factory
    _writer_factory = writer_factory
    _template_factory = template_factory


@dataclass
class DicomSegArtifact:
    path: Path
    label_count: int
    sop_instance_uid: str
    series_instance_uid: str
    study_instance_uid: str


# SCT (SNOMED CT) codes for the most common categories. Default fallback is
# "Tissue" / "Anatomical Structure" so a viewer at least groups segments under
# a sensible heading even for labels we have not curated.
_DEFAULT_CATEGORY = {
    "CodeValue": "T-D0050",
    "CodingSchemeDesignator": "SRT",
    "CodeMeaning": "Tissue",
}
_DEFAULT_TYPE = {
    "CodeValue": "T-D000A",
    "CodingSchemeDesignator": "SRT",
    "CodeMeaning": "Anatomical structure",
}

_TYPE_OVERRIDES: dict[str, dict[str, str]] = {
    "spleen": {"CodeValue": "T-C3000", "CodingSchemeDesignator": "SRT", "CodeMeaning": "Spleen"},
    "liver": {"CodeValue": "T-62000", "CodingSchemeDesignator": "SRT", "CodeMeaning": "Liver"},
    "heart": {"CodeValue": "T-32000", "CodingSchemeDesignator": "SRT", "CodeMeaning": "Heart"},
    "aorta": {"CodeValue": "T-42000", "CodingSchemeDesignator": "SRT", "CodeMeaning": "Aorta"},
    "trachea": {"CodeValue": "T-25000", "CodingSchemeDesignator": "SRT", "CodeMeaning": "Trachea"},
    "kidney_left": {"CodeValue": "T-71000", "CodingSchemeDesignator": "SRT", "CodeMeaning": "Kidney"},
    "kidney_right": {"CodeValue": "T-71000", "CodingSchemeDesignator": "SRT", "CodeMeaning": "Kidney"},
    "bone": {"CodeValue": "T-D016E", "CodingSchemeDesignator": "SRT", "CodeMeaning": "Bone"},
    "urinary_bladder": {
        "CodeValue": "T-74000", "CodingSchemeDesignator": "SRT", "CodeMeaning": "Urinary Bladder",
    },
    "brain": {"CodeValue": "T-A0100", "CodingSchemeDesignator": "SRT", "CodeMeaning": "Brain"},
}


def _segment_attributes_for(masks: list[LabeledMask]) -> list[dict[str, Any]]:
    """Build the dcmqi-style ``segmentAttributes`` array for the template.

    Index in the returned list maps to the new sequential SEG label id (1..N).
    """
    entries: list[dict[str, Any]] = []
    for index, labeled in enumerate(masks, start=1):
        type_code = _TYPE_OVERRIDES.get(labeled.name.lower(), _DEFAULT_TYPE)
        rgb = [int(round(channel * 255)) for channel in labeled.color]
        entries.append(
            {
                "labelID": index,
                "SegmentDescription": labeled.name.replace("_", " "),
                "SegmentLabel": labeled.name,
                "SegmentAlgorithmType": "SEMIAUTOMATIC",
                "SegmentAlgorithmName": "Radiolyze",
                "SegmentedPropertyCategoryCodeSequence": _DEFAULT_CATEGORY,
                "SegmentedPropertyTypeCodeSequence": type_code,
                "recommendedDisplayRGBValue": rgb,
            }
        )
    return entries


def _build_template_meta(
    masks: list[LabeledMask], series_description: str
) -> dict[str, Any]:
    return {
        "ContentCreatorName": "Radiolyze",
        "ClinicalTrialSeriesID": "Session1",
        "ClinicalTrialTimePointID": "1",
        "SeriesDescription": series_description,
        "SeriesNumber": "300",
        "InstanceNumber": "1",
        "BodyPartExamined": "",
        "ContentLabel": "SEGMENTATION",
        "ContentDescription": "Radiolyze multi-tissue segmentation",
        "ClinicalTrialCoordinatingCenterName": "Radiolyze",
        "segmentAttributes": [_segment_attributes_for(masks)],
    }


def _stack_to_multiclass(
    masks: list[LabeledMask], reference: sitk.Image
) -> sitk.Image:
    """Combine N binary masks into one uint16 SimpleITK image with values 1..N.

    Later labels overwrite earlier ones on conflict. We sort masks by descending
    voxel count so smaller (typically more specific) structures win against
    larger backgrounds — matches the behaviour radiologists expect when overlays
    overlap.
    """
    if not masks:
        raise ValueError("DICOM SEG needs at least one non-empty mask")

    shape = sitk.GetArrayFromImage(reference).shape  # (Z, Y, X)
    out = np.zeros(shape, dtype=np.uint16)

    # Smaller-first so larger structures don't overwrite carved-out detail.
    ordered = sorted(masks, key=lambda m: int(m.array.sum()), reverse=True)
    for new_id, labeled in enumerate(ordered, start=1):
        if labeled.array.shape != shape:
            raise ValueError(
                f"Label {labeled.name} has shape {labeled.array.shape}, "
                f"expected {shape}"
            )
        out[labeled.array] = new_id

    seg_image = sitk.GetImageFromArray(out)
    seg_image.CopyInformation(reference)
    return seg_image


def build_dicom_seg(
    *,
    masks: list[LabeledMask],
    source_datasets: list[pydicom.Dataset],
    reference: sitk.Image,
    output_path: Path,
    series_description: str = "Radiolyze segmentation",
) -> DicomSegArtifact:
    """Write a multi-class DICOM SEG referencing `source_datasets`.

    `output_path` is overwritten if it exists. Returns metadata about the
    resulting object so the caller can persist it (e.g. SOP Instance UID for
    audit trails).
    """
    if not masks:
        raise ValueError("Cannot build DICOM SEG without any labels")
    if not source_datasets:
        raise ValueError("Cannot build DICOM SEG without source CT datasets")

    writer_factory, template_factory = _resolve_pydicom_seg()

    # Reorder masks so SEG label ids match the order pydicom-seg expects.
    ordered_masks = sorted(masks, key=lambda m: int(m.array.sum()), reverse=True)

    template_meta = _build_template_meta(ordered_masks, series_description)
    template = template_factory(template_meta)

    seg_image = _stack_to_multiclass(ordered_masks, reference)

    writer = writer_factory(
        template=template,
        inplane_cropping=False,
        skip_empty_slices=True,
        skip_missing_segment=False,
    )
    dcm = writer.write(seg_image, source_datasets)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    dcm.save_as(str(output_path))

    return DicomSegArtifact(
        path=output_path,
        label_count=len(ordered_masks),
        sop_instance_uid=str(dcm.SOPInstanceUID),
        series_instance_uid=str(dcm.SeriesInstanceUID),
        study_instance_uid=str(dcm.StudyInstanceUID),
    )
