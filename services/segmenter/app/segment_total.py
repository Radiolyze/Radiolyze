from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Callable

import numpy as np
import SimpleITK as sitk

from .colors import color_for_label
from .labels import LabeledMask

logger = logging.getLogger(__name__)


class TotalSegmentatorUnavailable(RuntimeError):
    """Raised when the totalsegmentator package is not importable."""


# Indirection so tests can monkeypatch without paying TotalSegmentator's
# heavy import (~PyTorch + nnUNet) at unit-test time.
_runner: Callable[..., Any] | None = None


def _resolve_runner() -> Callable[..., Any]:
    """Lazily import totalsegmentator.python_api.totalsegmentator.

    The import is heavy (PyTorch + nnUNet); deferring it keeps service
    startup snappy and lets pure-Python tests skip it via monkeypatch.
    """
    global _runner
    if _runner is not None:
        return _runner
    try:
        from totalsegmentator.python_api import totalsegmentator  # type: ignore
    except Exception as exc:  # noqa: BLE001
        raise TotalSegmentatorUnavailable(
            "totalsegmentator is not installed in this image. "
            "Rebuild the segmenter image (CPU baseline includes it) or "
            "install it manually with `pip install totalsegmentator`."
        ) from exc
    _runner = totalsegmentator
    return _runner


def _set_runner_for_testing(fn: Callable[..., Any] | None) -> None:
    """Tests use this to inject a fake runner."""
    global _runner
    _runner = fn


def _label_id_for(name: str, *, fallback: int) -> int:
    """Deterministic stable id from the label name.

    TotalSegmentator emits one NIfTI file per label. Callers want a stable
    integer per label; we use a hash → small positive int. The `fallback`
    is the enumeration index so two labels never collide on the same id.
    """
    hashed = abs(hash(name)) % 9000
    return 1000 + hashed if hashed else fallback


def segment_total(
    volume: sitk.Image,
    *,
    job_dir: Path,
    fast: bool = True,
    task: str = "total",
) -> list[LabeledMask]:
    """Run TotalSegmentator on `volume` and return a list of label masks.

    Parameters
    ----------
    volume:
        HU-calibrated CT volume from the DICOM loader.
    job_dir:
        Per-job working directory; raw NIfTI input and intermediate label
        outputs are written under it.
    fast:
        If True (default for M2), use the 3 mm `total_fast` model — about
        a tenth of full-resolution VRAM at ~80 % of the spatial accuracy.
    task:
        TotalSegmentator task identifier; usually `total`.
    """
    runner = _resolve_runner()
    raw_path = job_dir / "raw" / "ct.nii.gz"
    label_dir = job_dir / "totalseg_out"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    label_dir.mkdir(parents=True, exist_ok=True)

    sitk.WriteImage(volume, str(raw_path), useCompression=True)

    device = os.getenv("TOTALSEG_DEVICE", "gpu" if _torch_has_cuda() else "cpu")
    logger.info(
        "Running TotalSegmentator: input=%s output=%s task=%s fast=%s device=%s",
        raw_path, label_dir, task, fast, device,
    )
    runner(
        input=str(raw_path),
        output=str(label_dir),
        task=task,
        fast=fast,
        device=device,
        ml=False,  # one NIfTI per label (default behaviour)
        quiet=True,
    )

    return _collect_labels(label_dir, reference=volume)


def _torch_has_cuda() -> bool:
    try:
        import torch  # type: ignore

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def _collect_labels(label_dir: Path, *, reference: sitk.Image) -> list[LabeledMask]:
    """Walk TotalSegmentator's output directory and lift each non-empty mask."""
    masks: list[LabeledMask] = []
    nifti_files = sorted(label_dir.glob("*.nii.gz"))
    for index, path in enumerate(nifti_files, start=1):
        name = path.name.removesuffix(".nii.gz")
        try:
            label_image = sitk.ReadImage(str(path))
        except Exception:
            logger.warning("Could not read label %s; skipping", path, exc_info=True)
            continue

        # Resample onto the reference grid so every mask shares the source
        # spacing/origin/direction. TotalSegmentator at fast=True returns
        # 3 mm output, which differs from the original 0.7×0.7×1.5 CT grid.
        if not _grids_match(label_image, reference):
            label_image = _resample_to_reference(label_image, reference)
        label_image.CopyInformation(reference)

        array = sitk.GetArrayFromImage(label_image).astype(bool)
        if not array.any():
            continue
        masks.append(
            LabeledMask(
                label_id=_label_id_for(name, fallback=index),
                name=name,
                color=color_for_label(name),
                array=array,
                image=label_image,
            )
        )
    return masks


def _grids_match(a: sitk.Image, b: sitk.Image) -> bool:
    return (
        a.GetSize() == b.GetSize()
        and np.allclose(a.GetSpacing(), b.GetSpacing(), atol=1e-3)
        and np.allclose(a.GetOrigin(), b.GetOrigin(), atol=1e-3)
        and np.allclose(a.GetDirection(), b.GetDirection(), atol=1e-3)
    )


def _resample_to_reference(label_image: sitk.Image, reference: sitk.Image) -> sitk.Image:
    resampler = sitk.ResampleImageFilter()
    resampler.SetReferenceImage(reference)
    resampler.SetInterpolator(sitk.sitkNearestNeighbor)
    resampler.SetDefaultPixelValue(0)
    return resampler.Execute(label_image)
