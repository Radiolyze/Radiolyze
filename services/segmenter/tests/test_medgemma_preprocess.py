from __future__ import annotations

import base64
import io

import numpy as np
import pytest
import SimpleITK as sitk
from PIL import Image

from app.dicom_loader import LoadedVolume
from app.medgemma_preprocess import (
    MAX_MODEL_SLICES,
    PreprocessResult,
    preprocess_volume,
    select_slice_indices,
)


def _synthetic_volume(
    shape: tuple[int, int, int] = (40, 64, 64),
    fill: float = -500.0,
    modality: str = "CT",
) -> LoadedVolume:
    z, y, x = shape
    arr = np.full(shape, fill, dtype=np.float32)
    # Add a high-density disc in the middle slice so windowing is visible.
    mid = z // 2
    yy, xx = np.indices((y, x))
    disc = (yy - y // 2) ** 2 + (xx - x // 2) ** 2 <= (min(y, x) // 4) ** 2
    arr[mid][disc] = 800.0
    image = sitk.GetImageFromArray(arr)
    image.SetSpacing((0.7, 0.7, 1.5))
    image.SetOrigin((0.0, 0.0, 0.0))
    image.SetDirection((1, 0, 0, 0, 1, 0, 0, 0, 1))
    return LoadedVolume(
        image=image,
        modality=modality,
        instance_count=z,
        source_datasets=None,
    )


def _decode(data_url: str) -> np.ndarray:
    assert data_url.startswith("data:image/png;base64,")
    payload = base64.b64decode(data_url.split(",", 1)[1])
    img = Image.open(io.BytesIO(payload))
    return np.asarray(img.convert("L"))


def test_select_slice_indices_uniform() -> None:
    indices = select_slice_indices(total=200, requested=10, strategy="uniform")
    assert indices[0] == 0
    assert indices[-1] == 199
    assert len(indices) == 10
    # Roughly evenly spaced
    diffs = np.diff(indices)
    assert diffs.min() >= 20 and diffs.max() <= 23


def test_select_slice_indices_central_skips_edges() -> None:
    indices = select_slice_indices(total=200, requested=10, strategy="central")
    assert indices[0] >= 40  # central crop starts at 20%
    assert indices[-1] <= 160  # ends at 80%


def test_select_slice_indices_caps_at_model_limit() -> None:
    indices = select_slice_indices(total=500, requested=200, strategy="uniform")
    assert len(indices) == MAX_MODEL_SLICES


def test_select_slice_indices_returns_all_when_below_request() -> None:
    indices = select_slice_indices(total=4, requested=10, strategy="uniform")
    assert indices == [0, 1, 2, 3]


def test_preprocess_ct_default_resolves_mediastinum() -> None:
    volume = _synthetic_volume(modality="CT")
    result = preprocess_volume(volume, max_slices=8, window_preset="auto", resize=128)
    assert result.window_preset == "mediastinum"
    assert result.modality == "CT"
    assert result.selected_count == 8
    assert result.total_count == 40
    assert result.resize == 128
    assert result.slice_thickness == pytest.approx(1.5)
    assert result.pixel_spacing == pytest.approx((0.7, 0.7))


def test_preprocess_ct_lung_window_brightens_air() -> None:
    volume = _synthetic_volume(fill=-700.0, modality="CT")
    lung = preprocess_volume(volume, max_slices=4, window_preset="lung", resize=128)
    bone = preprocess_volume(volume, max_slices=4, window_preset="bone", resize=128)
    lung_mid = _decode(lung.slices[1].data_url).mean()
    bone_mid = _decode(bone.slices[1].data_url).mean()
    # Air (-700 HU) is well within the lung window but below the bone window;
    # therefore the lung-window image should be much brighter.
    assert lung_mid > bone_mid + 10


def test_preprocess_mr_normalizes_dynamic_range() -> None:
    # Build an MR-style volume with a per-slice gradient so every slice has
    # a non-trivial dynamic range (otherwise the robust 1./99. percentile
    # collapses to a single value, which is the expected behaviour for a
    # uniform slice).
    z, y, x = 40, 64, 64
    arr = np.zeros((z, y, x), dtype=np.float32)
    yy, xx = np.indices((y, x))
    arr[:] = (yy + xx).astype(np.float32) * 4.0
    image = sitk.GetImageFromArray(arr)
    image.SetSpacing((0.7, 0.7, 1.5))
    image.SetOrigin((0.0, 0.0, 0.0))
    image.SetDirection((1, 0, 0, 0, 1, 0, 0, 0, 1))
    volume = LoadedVolume(image=image, modality="MR", instance_count=z)

    result = preprocess_volume(volume, max_slices=4, window_preset="auto", resize=64)
    assert result.window_preset == "mr"
    decoded = _decode(result.slices[1].data_url)
    assert decoded.shape == (64, 64)
    # MR normalization should produce a non-trivial dynamic range
    assert decoded.max() - decoded.min() > 50


def test_preprocess_resizes_to_requested_side() -> None:
    volume = _synthetic_volume(shape=(8, 32, 32))
    result = preprocess_volume(volume, max_slices=4, resize=896)
    arr = _decode(result.slices[0].data_url)
    assert arr.shape == (896, 896)


def test_preprocess_data_url_is_valid_png() -> None:
    volume = _synthetic_volume(shape=(8, 64, 64))
    result = preprocess_volume(volume, max_slices=2, resize=128)
    decoded = _decode(result.slices[0].data_url)
    assert decoded.dtype == np.uint8
    assert decoded.shape == (128, 128)


def test_preprocess_indices_are_one_based_and_dense() -> None:
    volume = _synthetic_volume(shape=(32, 32, 32))
    result = preprocess_volume(volume, max_slices=8, resize=64)
    assert [s.index for s in result.slices] == list(range(1, 9))
    # source_index strictly increasing
    src = [s.source_index for s in result.slices]
    assert src == sorted(set(src))


def test_preprocess_rejects_empty_volume() -> None:
    arr = np.zeros((0, 0, 0), dtype=np.float32)
    image = sitk.GetImageFromArray(arr)
    volume = LoadedVolume(image=image, modality="CT", instance_count=0)
    with pytest.raises(ValueError):
        preprocess_volume(volume, max_slices=4)


def test_preprocess_handles_unknown_modality() -> None:
    volume = _synthetic_volume(modality="US")
    result = preprocess_volume(volume, max_slices=4, resize=64)
    # Unknown modality should fall back to MR-style normalization
    assert result.window_preset == "mr"
    assert isinstance(result, PreprocessResult)
