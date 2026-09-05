"""DICOM Segmentation (SEG) writer.

Converts our list of `LabeledMask` artefacts into a single multi-class
DICOM SEG object that references the original CT slices by SOP Instance
UID, so a PACS viewer can overlay the segmentation back on the source
study without any external bookkeeping.

We use ``highdicom`` (MIT). The lazy import keeps service startup fast —
it pulls in the whole IOD machinery, which is only needed once a job
actually reaches the export step.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pydicom
import SimpleITK as sitk
from pydicom.sr.coding import Code
from pydicom.uid import generate_uid

from .labels import LabeledMask

logger = logging.getLogger(__name__)


class DicomSegUnavailable(RuntimeError):
    """Raised when highdicom is missing or incompatible."""


@lru_cache(maxsize=1)
def _resolve_highdicom() -> dict[str, Any]:
    """Import the highdicom pieces we need, or explain why we can't.

    Cached so the import cost is paid once per process. Tests clear the cache
    via ``_resolve_highdicom.cache_clear()``.
    """
    try:
        from highdicom import AlgorithmIdentificationSequence
        from highdicom.color import CIELabColor
        from highdicom.seg import (
            SegmentAlgorithmTypeValues,
            Segmentation,
            SegmentationTypeValues,
            SegmentDescription,
        )
    except Exception as exc:  # noqa: BLE001
        raise DicomSegUnavailable(
            "highdicom is not installed in this image. Rebuild the segmenter "
            "with the current requirements.txt to enable DICOM SEG export."
        ) from exc
    return {
        "AlgorithmIdentificationSequence": AlgorithmIdentificationSequence,
        "CIELabColor": CIELabColor,
        "SegmentAlgorithmTypeValues": SegmentAlgorithmTypeValues,
        "Segmentation": Segmentation,
        "SegmentationTypeValues": SegmentationTypeValues,
        "SegmentDescription": SegmentDescription,
    }


@dataclass
class DicomSegArtifact:
    path: Path
    label_count: int
    sop_instance_uid: str
    series_instance_uid: str
    study_instance_uid: str


_MANUFACTURER = "Radiolyze"
_MODEL_NAME = "Radiolyze Segmenter"
_DEVICE_SERIAL_NUMBER = "RADIOLYZE-SEGMENTER"
_SERIES_NUMBER = 300

# SNOMED CT codes. The default fallback is "Tissue" / "Anatomical structure"
# so a viewer at least groups segments under a sensible heading even for
# labels we have not curated.
_DEFAULT_CATEGORY = Code("85756007", "SCT", "Tissue")
_DEFAULT_TYPE = Code("91723000", "SCT", "Anatomical structure")

_TYPE_OVERRIDES: dict[str, Code] = {
    "spleen": Code("78961009", "SCT", "Spleen"),
    "liver": Code("10200004", "SCT", "Liver"),
    "heart": Code("80891009", "SCT", "Heart"),
    "aorta": Code("15825003", "SCT", "Aorta"),
    "trachea": Code("44567001", "SCT", "Trachea"),
    "kidney_left": Code("64033007", "SCT", "Kidney"),
    "kidney_right": Code("64033007", "SCT", "Kidney"),
    "bone": Code("272673000", "SCT", "Bone"),
    "urinary_bladder": Code("89837001", "SCT", "Urinary bladder"),
    "brain": Code("12738006", "SCT", "Brain"),
}


def _software_versions() -> str:
    """Identify the writer in the SEG's Equipment module.

    The highdicom version is included because the encoding of the object —
    frame ordering, functional groups — is its responsibility, so knowing it
    is what makes a SEG we wrote reproducible after the fact. Kept to a single
    LO value rather than a multi-valued one, which pydicom rejects for this VR.
    """
    try:
        from importlib.metadata import version

        return f"{_MODEL_NAME} (highdicom {version('highdicom')})"
    except Exception:  # noqa: BLE001
        return _MODEL_NAME


def _display_color(rgb: tuple[float, float, float]) -> Any:
    """Convert our 0..1 sRGB label colour to the CIELab value DICOM wants.

    Returns ``None`` when the conversion is unavailable, in which case the
    segment simply carries no recommended display colour — a viewer falls back
    to its own palette rather than the export failing.
    """
    cielab_color = _resolve_highdicom()["CIELabColor"]
    try:
        from skimage.color import rgb2lab

        lab = rgb2lab(np.asarray([[list(rgb)]], dtype=np.float64))[0][0]
        return cielab_color(float(lab[0]), float(lab[1]), float(lab[2]))
    except Exception:  # noqa: BLE001
        logger.debug("Could not convert label colour %s to CIELab", rgb, exc_info=True)
        return None


def _segment_descriptions(masks: list[LabeledMask]) -> list[Any]:
    """Describe each segment; list index + 1 is the SEG segment number.

    The order must match the label ids `_stack_to_multiclass` assigns, which
    is why both take the same pre-sorted list.
    """
    parts = _resolve_highdicom()
    segment_description = parts["SegmentDescription"]
    algorithm_identification = parts["AlgorithmIdentificationSequence"](
        name=_MODEL_NAME,
        version=_software_versions(),
        family=Code("123110", "DCM", "Artificial Intelligence"),
    )

    descriptions: list[Any] = []
    for index, labeled in enumerate(masks, start=1):
        descriptions.append(
            segment_description(
                segment_number=index,
                segment_label=labeled.name,
                segmented_property_category=_DEFAULT_CATEGORY,
                segmented_property_type=_TYPE_OVERRIDES.get(labeled.name.lower(), _DEFAULT_TYPE),
                algorithm_type=parts["SegmentAlgorithmTypeValues"].SEMIAUTOMATIC,
                algorithm_identification=algorithm_identification,
                display_color=_display_color(labeled.color),
            )
        )
    return descriptions


# Type 2 attributes highdicom reads off the first source image without a
# fallback. They are "required, may be empty" in DICOM, so conformant data
# always carries them — but anonymisers and synthetic series drop them, and a
# missing one would abort the export at runtime rather than at load time.
_REQUIRED_SOURCE_ATTRIBUTES = (
    "PatientID",
    "PatientName",
    "PatientBirthDate",
    "PatientSex",
    "AccessionNumber",
    "StudyID",
    "StudyDate",
    "StudyTime",
)


def _with_required_attributes(
    source_datasets: list[pydicom.Dataset],
) -> list[pydicom.Dataset]:
    """Fill in empty values for type 2 attributes the first source is missing.

    Only the first dataset is inspected because that is the only one highdicom
    reads them from. It is copied rather than patched in place so the caller's
    datasets are left untouched; the copy is skipped entirely when nothing is
    missing, which is the case for anything a conformant PACS returns.
    """
    first = source_datasets[0]
    missing = [attr for attr in _REQUIRED_SOURCE_ATTRIBUTES if attr not in first]
    if not missing:
        return source_datasets

    logger.info(
        "Source series is missing type 2 attribute(s) %s; writing them empty into the SEG.",
        ", ".join(missing),
    )
    from copy import deepcopy

    patched = deepcopy(first)
    for attr in missing:
        setattr(patched, attr, "")
    return [patched, *source_datasets[1:]]


def _order_masks(masks: list[LabeledMask]) -> list[LabeledMask]:
    """Largest first, so smaller structures win where labels overlap.

    A DICOM SEG label map is mutually exclusive — each voxel carries exactly
    one segment number — so an overlap has to be resolved one way or the
    other. Writing the larger structure first lets the smaller (typically more
    specific) one overwrite it, which matches what radiologists expect when
    overlays overlap.
    """
    return sorted(masks, key=lambda m: int(m.array.sum()), reverse=True)


def _stack_to_multiclass(masks: list[LabeledMask], reference: sitk.Image) -> sitk.Image:
    """Combine N binary masks into one uint16 SimpleITK image with values 1..N.

    Expects `masks` in the order `_order_masks` produces: later labels
    overwrite earlier ones on conflict.
    """
    if not masks:
        raise ValueError("DICOM SEG needs at least one non-empty mask")

    shape = sitk.GetArrayFromImage(reference).shape  # (Z, Y, X)
    out = np.zeros(shape, dtype=np.uint16)

    for new_id, labeled in enumerate(masks, start=1):
        if labeled.array.shape != shape:
            raise ValueError(
                f"Label {labeled.name} has shape {labeled.array.shape}, expected {shape}"
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

    `source_datasets` must be in the same slice order as `reference`, which is
    what `dicom_loader.fetch_series_volume` returns: highdicom pairs frame
    ``i`` of the label map with ``source_datasets[i]``.

    `output_path` is overwritten if it exists. Returns metadata about the
    resulting object so the caller can persist it (e.g. SOP Instance UID for
    audit trails).
    """
    if not masks:
        raise ValueError("Cannot build DICOM SEG without any labels")
    if not source_datasets:
        raise ValueError("Cannot build DICOM SEG without source CT datasets")

    parts = _resolve_highdicom()

    ordered_masks = _order_masks(masks)
    descriptions = _segment_descriptions(ordered_masks)

    seg_image = _stack_to_multiclass(ordered_masks, reference)
    label_map = sitk.GetArrayFromImage(seg_image)
    if label_map.shape[0] != len(source_datasets):
        raise ValueError(
            f"Label map has {label_map.shape[0]} slices but "
            f"{len(source_datasets)} source datasets were given; highdicom "
            "pairs them by index."
        )

    segmentation = parts["Segmentation"](
        source_images=_with_required_attributes(source_datasets),
        pixel_array=label_map,
        segmentation_type=parts["SegmentationTypeValues"].BINARY,
        segment_descriptions=descriptions,
        series_instance_uid=generate_uid(),
        series_number=_SERIES_NUMBER,
        sop_instance_uid=generate_uid(),
        instance_number=1,
        manufacturer=_MANUFACTURER,
        manufacturer_model_name=_MODEL_NAME,
        software_versions=_software_versions(),
        device_serial_number=_DEVICE_SERIAL_NUMBER,
        series_description=series_description,
        content_description="Radiolyze multi-tissue segmentation",
        # Trailing caret: a single-component person name is otherwise ambiguous.
        content_creator_name=f"{_MANUFACTURER}^",
        content_label="SEGMENTATION",
        omit_empty_frames=True,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    segmentation.save_as(str(output_path))

    return DicomSegArtifact(
        path=output_path,
        label_count=len(ordered_masks),
        sop_instance_uid=str(segmentation.SOPInstanceUID),
        series_instance_uid=str(segmentation.SeriesInstanceUID),
        study_instance_uid=str(segmentation.StudyInstanceUID),
    )
