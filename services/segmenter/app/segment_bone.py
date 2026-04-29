from __future__ import annotations

import numpy as np
import SimpleITK as sitk
from skimage.morphology import ball, opening

from .config import bone_hu_threshold
from .labels import LabeledMask


def segment_bone(volume: sitk.Image, *, threshold: float | None = None) -> list[LabeledMask]:
    """Pure HU thresholding; returns a single 'bone' label.

    The input must already be HU-calibrated (the DICOM loader applies
    RescaleSlope/Intercept). MR or unknown-modality inputs are passed through
    unchanged — callers should gate on modality.
    """
    cutoff = bone_hu_threshold() if threshold is None else float(threshold)
    array = sitk.GetArrayFromImage(volume)
    mask = array >= cutoff
    if mask.any():
        # Lightweight cleanup: drop single-voxel speckle. Keep the radius
        # small so a thin cortex is not eroded away.
        mask = opening(mask, ball(1)).astype(bool)

    mask_image = sitk.GetImageFromArray(mask.astype(np.uint8))
    mask_image.CopyInformation(volume)

    return [
        LabeledMask(
            label_id=1,
            name="bone",
            color=(0.93, 0.87, 0.74),
            array=mask,
            image=mask_image,
        )
    ]
