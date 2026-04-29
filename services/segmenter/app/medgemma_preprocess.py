"""MedGemma 1.5 3D volume preprocessor.

Converts a SimpleITK volume (typically loaded by ``dicom_loader.fetch_series_volume``)
into a sequence of axial 2D slices that conform to MedGemma 1.5's requirements:

- axial orientation (the SimpleITK volume from ``_datasets_to_sitk`` is already
  axial-ordered along z)
- each slice <= 512x512 (we additionally resize to 896x896 to match the SigLIP
  encoder's input resolution)
- modality-appropriate windowing (CT) or robust per-volume normalization (MR)
- up to 85 slices per volume (MedGemma model card) — we pick a smaller default
  because more slices linearly cost vision tokens

The output is a list of inline data URLs (``data:image/png;base64,...``) ready
to be appended to a vLLM chat-completion ``image_url`` payload.
"""

from __future__ import annotations

import base64
import io
import logging
import os
from dataclasses import dataclass
from typing import Literal

import numpy as np
import SimpleITK as sitk
from PIL import Image

from .dicom_loader import LoadedVolume

logger = logging.getLogger(__name__)

WindowPreset = Literal["auto", "lung", "mediastinum", "bone", "abdomen", "mr"]
SliceStrategy = Literal["uniform", "central"]

# Centre / Width per CT preset, per common radiology defaults.
CT_WINDOWS: dict[str, tuple[float, float]] = {
    "lung": (-600.0, 1500.0),
    "mediastinum": (40.0, 400.0),
    "bone": (300.0, 1500.0),
    "abdomen": (40.0, 400.0),
}

# Hard ceiling per MedGemma 1.5 model card.
MAX_MODEL_SLICES = 85


@dataclass
class PreprocessedSlice:
    index: int  # 1-based index within the selected sequence (matches manifest)
    source_index: int  # 0-based index in the original volume
    z_position: float | None
    instance_uid: str | None
    instance_number: int | None
    data_url: str


@dataclass
class PreprocessResult:
    slices: list[PreprocessedSlice]
    modality: str
    window_preset: WindowPreset
    strategy: SliceStrategy
    selected_count: int
    total_count: int
    resize: int
    pixel_spacing: tuple[float, float] | None
    slice_thickness: float | None


def _resolve_preset(modality: str, requested: WindowPreset, series_description: str | None) -> WindowPreset:
    if requested != "auto":
        return requested
    mod = (modality or "").upper()
    if mod in {"MR", "MRI"}:
        return "mr"
    if mod in {"CT", "CTA"}:
        desc = (series_description or "").lower()
        if any(token in desc for token in ("lung", "thorax", "chest")):
            return "lung"
        if "bone" in desc:
            return "bone"
        if any(token in desc for token in ("abd", "liver", "pelvis")):
            return "abdomen"
        return "mediastinum"
    # Fallback: treat unknown modalities as MR-style robust normalization
    return "mr"


def _ct_window(slice_array: np.ndarray, preset: WindowPreset) -> np.ndarray:
    centre, width = CT_WINDOWS[preset]
    lower = centre - width / 2.0
    upper = centre + width / 2.0
    clipped = np.clip(slice_array, lower, upper)
    scaled = (clipped - lower) / (upper - lower) * 255.0
    return scaled.astype(np.uint8)


def _mr_normalize(slice_array: np.ndarray) -> np.ndarray:
    # Robust 1./99. percentile rescale, computed per-slice to handle B1/coil
    # shading. For more consistent appearance across slices a volume-wide
    # rescale would be preferable, but per-slice is robust and cheap.
    finite = slice_array[np.isfinite(slice_array)]
    if finite.size == 0:
        return np.zeros(slice_array.shape, dtype=np.uint8)
    lo, hi = np.percentile(finite, [1.0, 99.0])
    if hi - lo < 1e-6:
        return np.zeros(slice_array.shape, dtype=np.uint8)
    clipped = np.clip(slice_array, lo, hi)
    scaled = (clipped - lo) / (hi - lo) * 255.0
    return scaled.astype(np.uint8)


def _window_slice(slice_array: np.ndarray, preset: WindowPreset) -> np.ndarray:
    if preset == "mr":
        return _mr_normalize(slice_array)
    return _ct_window(slice_array, preset)


def _resize(arr: np.ndarray, side: int) -> np.ndarray:
    if arr.shape[0] == side and arr.shape[1] == side:
        return arr
    image = Image.fromarray(arr, mode="L")
    resized = image.resize((side, side), resample=Image.Resampling.LANCZOS)
    return np.asarray(resized, dtype=np.uint8)


def _encode_png_data_url(arr: np.ndarray) -> str:
    image = Image.fromarray(arr, mode="L").convert("RGB")
    buf = io.BytesIO()
    image.save(buf, format="PNG", optimize=True)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def select_slice_indices(total: int, requested: int, strategy: SliceStrategy) -> list[int]:
    """Pick ``requested`` slice indices in [0, total).

    Always returns sorted, unique indices. If ``total <= requested``, returns
    every index. Strategies:
    - ``uniform``: evenly spaced including endpoints.
    - ``central``: same as uniform but cropped to the central 60% of the
      volume (skips the very top/bottom where anatomy is often missing).
    """
    requested = max(1, min(requested, MAX_MODEL_SLICES, total))
    if total <= requested:
        return list(range(total))

    if strategy == "central":
        start = int(total * 0.20)
        end = int(total * 0.80)
        if end - start < requested:
            start = 0
            end = total
    else:
        start = 0
        end = total

    if requested == 1:
        return [(start + end) // 2]
    step = (end - 1 - start) / (requested - 1)
    indices = [int(round(start + i * step)) for i in range(requested)]
    # Deduplicate while preserving order (rare on tiny volumes).
    seen: set[int] = set()
    unique: list[int] = []
    for idx in indices:
        if idx not in seen and 0 <= idx < total:
            seen.add(idx)
            unique.append(idx)
    return unique


def preprocess_volume(
    volume: LoadedVolume,
    *,
    max_slices: int = 64,
    window_preset: WindowPreset = "auto",
    strategy: SliceStrategy = "uniform",
    resize: int = 896,
) -> PreprocessResult:
    """Render the in-memory volume to a list of MedGemma-ready slice data URLs."""
    arr = sitk.GetArrayFromImage(volume.image)  # (z, y, x), float32 after rescale
    total = int(arr.shape[0])
    if total == 0:
        raise ValueError("Volume has zero slices")

    series_desc = None
    if volume.source_datasets:
        series_desc = getattr(volume.source_datasets[0], "SeriesDescription", None)
    preset = _resolve_preset(volume.modality, window_preset, series_desc)

    indices = select_slice_indices(total, max_slices, strategy)

    spacing = volume.image.GetSpacing()  # (sx, sy, sz)
    pixel_spacing: tuple[float, float] | None
    slice_thickness: float | None
    if len(spacing) >= 3:
        pixel_spacing = (float(spacing[1]), float(spacing[0]))  # (row, col)
        slice_thickness = float(spacing[2])
    else:
        pixel_spacing = None
        slice_thickness = None

    out: list[PreprocessedSlice] = []
    for manifest_index, src_idx in enumerate(indices, start=1):
        slice_arr = arr[src_idx]
        windowed = _window_slice(slice_arr, preset)
        resized = _resize(windowed, resize)
        data_url = _encode_png_data_url(resized)

        z_position: float | None = None
        instance_uid: str | None = None
        instance_number: int | None = None
        if volume.source_datasets and src_idx < len(volume.source_datasets):
            ds = volume.source_datasets[src_idx]
            pos = getattr(ds, "ImagePositionPatient", None)
            if pos is not None:
                try:
                    z_position = float(pos[2])
                except (TypeError, ValueError, IndexError):
                    z_position = None
            sop = getattr(ds, "SOPInstanceUID", None)
            instance_uid = str(sop) if sop else None
            num = getattr(ds, "InstanceNumber", None)
            try:
                instance_number = int(num) if num is not None else None
            except (TypeError, ValueError):
                instance_number = None

        out.append(
            PreprocessedSlice(
                index=manifest_index,
                source_index=src_idx,
                z_position=z_position,
                instance_uid=instance_uid,
                instance_number=instance_number,
                data_url=data_url,
            )
        )

    return PreprocessResult(
        slices=out,
        modality=volume.modality,
        window_preset=preset,
        strategy=strategy,
        selected_count=len(out),
        total_count=total,
        resize=resize,
        pixel_spacing=pixel_spacing,
        slice_thickness=slice_thickness,
    )


def env_max_slices() -> int:
    try:
        value = int(os.getenv("MEDGEMMA_VOLUME_MAX_SLICES", "64"))
    except ValueError:
        value = 64
    return max(1, min(value, MAX_MODEL_SLICES))


def env_default_preset() -> WindowPreset:
    raw = (os.getenv("MEDGEMMA_VOLUME_WINDOW_PRESET") or "auto").strip().lower()
    if raw not in {"auto", "lung", "mediastinum", "bone", "abdomen", "mr"}:
        return "auto"
    return raw  # type: ignore[return-value]


def env_default_strategy() -> SliceStrategy:
    raw = (os.getenv("MEDGEMMA_VOLUME_STRATEGY") or "uniform").strip().lower()
    if raw not in {"uniform", "central"}:
        return "uniform"
    return raw  # type: ignore[return-value]


def env_default_resize() -> int:
    try:
        value = int(os.getenv("MEDGEMMA_VOLUME_RESIZE", "896"))
    except ValueError:
        value = 896
    return max(64, min(value, 2048))
