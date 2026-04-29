from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import SimpleITK as sitk

ColorRGB = tuple[float, float, float]


@dataclass
class LabeledMask:
    """A single segmentation label ready for meshing.

    Shared between the bone-HU and TotalSegmentator pipelines so the rest of
    the service treats them identically.
    """

    label_id: int
    name: str
    color: ColorRGB
    array: np.ndarray  # shape (Z, Y, X), bool
    image: sitk.Image  # uint8 mask carrying the source spacing/origin/direction
