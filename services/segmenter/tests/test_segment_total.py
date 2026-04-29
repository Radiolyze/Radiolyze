"""Tests for the TotalSegmentator pipeline.

Because TotalSegmentator pulls PyTorch + nnU-Net (~2 GB) we never call the
real runner in tests. Instead we monkey-patch `_set_runner_for_testing` with
a fake that writes a few NIfTI label files into the requested output dir,
exercising the full collection / resampling / meshing path.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
import SimpleITK as sitk

from app import segment_total
from app.colors import color_for_label
from app.labels import LabeledMask
from app.segment_total import (
    TotalSegmentatorUnavailable,
    _collect_labels,
    _resolve_runner,
    _set_runner_for_testing,
    segment_total as run_segment_total,
)


def _reference_volume(shape=(16, 32, 32), spacing=(0.7, 0.7, 1.5)) -> sitk.Image:
    arr = np.zeros(shape, dtype=np.float32)
    image = sitk.GetImageFromArray(arr)
    image.SetSpacing(spacing)
    image.SetOrigin((10.0, -5.0, 100.0))
    image.SetDirection((1, 0, 0, 0, 1, 0, 0, 0, 1))
    return image


def _binary_sphere(shape, center, radius) -> np.ndarray:
    z, y, x = np.indices(shape)
    cz, cy, cx = center
    return (z - cz) ** 2 + (y - cy) ** 2 + (x - cx) ** 2 <= radius**2


def _write_mask(path: Path, mask: np.ndarray, reference: sitk.Image) -> None:
    image = sitk.GetImageFromArray(mask.astype(np.uint8))
    image.CopyInformation(reference)
    sitk.WriteImage(image, str(path), useCompression=True)


@pytest.fixture(autouse=True)
def reset_runner():
    """Make sure no test leaves a stale runner pointer behind."""
    yield
    _set_runner_for_testing(None)


def test_resolve_runner_raises_when_totalsegmentator_missing(monkeypatch):
    _set_runner_for_testing(None)

    import builtins
    real_import = builtins.__import__

    def _block(name, globals=None, locals=None, fromlist=(), level=0):
        if name.startswith("totalsegmentator"):
            raise ImportError("simulated missing dep")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", _block)

    with pytest.raises(TotalSegmentatorUnavailable):
        _resolve_runner()


def test_segment_total_collects_two_organs(tmp_path):
    reference = _reference_volume()
    job_dir = tmp_path / "job"
    job_dir.mkdir()

    spleen = _binary_sphere(reference.GetSize()[::-1], center=(8, 16, 16), radius=4)
    kidney = _binary_sphere(reference.GetSize()[::-1], center=(8, 8, 8), radius=3)

    def _fake_runner(*, input, output, task, fast, device, ml=False, quiet=True):
        out = Path(output)
        out.mkdir(parents=True, exist_ok=True)
        _write_mask(out / "spleen.nii.gz", spleen, reference)
        _write_mask(out / "kidney_left.nii.gz", kidney, reference)

    _set_runner_for_testing(_fake_runner)

    labels = run_segment_total(reference, job_dir=job_dir, fast=True)
    names = sorted(label.name for label in labels)
    assert names == ["kidney_left", "spleen"]

    spleen_label = next(label for label in labels if label.name == "spleen")
    assert spleen_label.color == color_for_label("spleen")
    assert int(spleen_label.array.sum()) > 0
    assert spleen_label.image.GetSpacing() == reference.GetSpacing()


def test_segment_total_skips_empty_masks(tmp_path):
    reference = _reference_volume()
    job_dir = tmp_path / "job"
    job_dir.mkdir()

    nonempty = _binary_sphere(reference.GetSize()[::-1], center=(8, 16, 16), radius=4)
    empty = np.zeros(reference.GetSize()[::-1], dtype=bool)

    def _fake_runner(**_kwargs):
        out = Path(_kwargs["output"])
        out.mkdir(parents=True, exist_ok=True)
        _write_mask(out / "spleen.nii.gz", nonempty, reference)
        _write_mask(out / "phantom.nii.gz", empty, reference)

    _set_runner_for_testing(_fake_runner)

    labels = run_segment_total(reference, job_dir=job_dir)
    assert [label.name for label in labels] == ["spleen"]


def test_segment_total_resamples_mismatched_grid(tmp_path):
    """TotalSegmentator at fast=True writes 3 mm masks. We must resample
    them onto the source CT grid before meshing, otherwise the mesh ends up
    in the wrong physical location."""
    reference = _reference_volume(shape=(16, 32, 32), spacing=(0.7, 0.7, 1.5))
    job_dir = tmp_path / "job"
    job_dir.mkdir()

    coarse_arr = np.zeros((4, 8, 8), dtype=np.uint8)
    coarse_arr[2, 4, 4] = 1  # one voxel at the coarse grid centre
    coarse = sitk.GetImageFromArray(coarse_arr)
    coarse.SetSpacing((3.0, 3.0, 3.0))
    coarse.SetOrigin(reference.GetOrigin())
    coarse.SetDirection(reference.GetDirection())

    out_dir = job_dir / "totalseg_out"
    out_dir.mkdir()
    sitk.WriteImage(coarse, str(out_dir / "spleen.nii.gz"), useCompression=True)

    labels = _collect_labels(out_dir, reference=reference)
    assert len(labels) == 1
    spleen = labels[0]
    # After resampling the mask must live on the reference grid, not the 3 mm one.
    assert spleen.image.GetSize() == reference.GetSize()
    assert spleen.image.GetSpacing() == reference.GetSpacing()


def test_label_id_is_stable_for_same_name(tmp_path):
    """Re-running the pipeline on the same label set must yield identical
    label IDs, otherwise the frontend cache invalidates on every poll."""
    reference = _reference_volume()
    sphere = _binary_sphere(reference.GetSize()[::-1], (8, 16, 16), 3)

    def _runner(**kwargs):
        out = Path(kwargs["output"])
        out.mkdir(parents=True, exist_ok=True)
        _write_mask(out / "spleen.nii.gz", sphere, reference)

    _set_runner_for_testing(_runner)
    first = run_segment_total(reference, job_dir=tmp_path / "a")
    _set_runner_for_testing(_runner)
    second = run_segment_total(reference, job_dir=tmp_path / "b")
    assert first[0].label_id == second[0].label_id


def test_color_palette_handles_unknown_labels():
    assert color_for_label("rib_left_4") != (0.78, 0.78, 0.78)
    assert color_for_label("vertebrae_T7") != (0.78, 0.78, 0.78)
    assert color_for_label("totally_made_up_label") == (0.78, 0.78, 0.78)


def test_color_palette_includes_canonical_organs():
    for organ in ["spleen", "liver", "aorta", "heart_myocardium", "lung_upper_lobe_left"]:
        rgb = color_for_label(organ)
        assert all(0.0 <= v <= 1.0 for v in rgb)
