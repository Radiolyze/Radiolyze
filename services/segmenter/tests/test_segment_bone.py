from __future__ import annotations

import numpy as np
import SimpleITK as sitk

from app.segment_bone import segment_bone


def _synthetic_volume(shape: tuple[int, int, int] = (32, 64, 64)) -> sitk.Image:
    """Build a small CT-shaped volume with a high-HU sphere in the middle."""
    z, y, x = shape
    arr = np.full(shape, -500.0, dtype=np.float32)
    cz, cy, cx = z // 2, y // 2, x // 2
    radius = min(shape) // 4
    z_idx, y_idx, x_idx = np.indices(shape)
    sphere = (z_idx - cz) ** 2 + (y_idx - cy) ** 2 + (x_idx - cx) ** 2 <= radius**2
    arr[sphere] = 800.0  # bone-range HU
    image = sitk.GetImageFromArray(arr)
    image.SetSpacing((0.8, 0.8, 1.5))
    image.SetOrigin((0.0, 0.0, 0.0))
    image.SetDirection((1, 0, 0, 0, 1, 0, 0, 0, 1))
    return image


def test_segment_bone_extracts_high_hu_sphere() -> None:
    image = _synthetic_volume()
    masks = segment_bone(image)
    assert len(masks) == 1
    bone = masks[0]
    assert bone.name == "bone"
    assert bone.label_id == 1
    assert bone.array.dtype == bool
    assert int(bone.array.sum()) > 100, "expected the synthetic sphere to be detected"


def test_segment_bone_returns_empty_mask_for_low_hu() -> None:
    arr = np.full((16, 32, 32), -500.0, dtype=np.float32)
    image = sitk.GetImageFromArray(arr)
    image.SetSpacing((1.0, 1.0, 1.0))
    masks = segment_bone(image)
    assert len(masks) == 1
    assert masks[0].array.sum() == 0
