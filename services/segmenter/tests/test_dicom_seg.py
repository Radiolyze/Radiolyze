"""Tests for the DICOM SEG writer.

These exercise the real `highdicom` writer against synthetic masks and a
synthetic source series — deliberately not a stub. The bug this guards
against (see #199) is a dependency bump that installs cleanly and only
breaks when an export is actually attempted: a test that stubs the writer,
or skips when it is missing, reports green for exactly that failure.

So the round-trip test reads the written file back through highdicom and
compares the decoded label map voxel-for-voxel with what went in. An
encoding regression has to change those voxels to stay hidden.
"""

from __future__ import annotations

import builtins
from pathlib import Path

import numpy as np
import pydicom
import pytest
import SimpleITK as sitk
from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian, generate_uid

from app.dicom_seg import (
    DicomSegUnavailable,
    _order_masks,
    _resolve_highdicom,
    _stack_to_multiclass,
    build_dicom_seg,
)
from app.labels import LabeledMask


def _reference_volume(shape=(8, 32, 32)) -> sitk.Image:
    arr = np.zeros(shape, dtype=np.float32)
    image = sitk.GetImageFromArray(arr)
    image.SetSpacing((0.7, 0.7, 1.5))
    image.SetOrigin((10.0, -5.0, 100.0))
    image.SetDirection((1, 0, 0, 0, 1, 0, 0, 0, 1))
    return image


def _binary_sphere(shape, center, radius) -> np.ndarray:
    z, y, x = np.indices(shape)
    cz, cy, cx = center
    return (z - cz) ** 2 + (y - cy) ** 2 + (x - cx) ** 2 <= radius**2


def _make_label(label_id: int, name: str, mask: np.ndarray, reference: sitk.Image) -> LabeledMask:
    img = sitk.GetImageFromArray(mask.astype(np.uint8))
    img.CopyInformation(reference)
    return LabeledMask(
        label_id=label_id,
        name=name,
        color=(0.8, 0.4, 0.4),
        array=mask,
        image=img,
    )


def _make_source_datasets(reference: sitk.Image) -> list[pydicom.Dataset]:
    """Build a synthetic CT series matching the reference volume.

    Each slice carries the metadata highdicom actually consults
    (PatientID, StudyInstanceUID, SeriesInstanceUID, FrameOfReferenceUID,
    ImageOrientation/PositionPatient, PixelSpacing, SOPInstanceUID, …).
    """
    arr = sitk.GetArrayFromImage(reference)  # (Z, Y, X)
    spacing = reference.GetSpacing()  # (sx, sy, sz)
    origin = reference.GetOrigin()
    z_size = arr.shape[0]
    rows = arr.shape[1]
    cols = arr.shape[2]

    study_uid = generate_uid()
    series_uid = generate_uid()
    frame_uid = generate_uid()
    sop_class = CTImageStorage

    datasets: list[pydicom.Dataset] = []
    for k in range(z_size):
        sop_instance_uid = generate_uid()
        meta = FileMetaDataset()
        meta.MediaStorageSOPClassUID = sop_class
        meta.MediaStorageSOPInstanceUID = sop_instance_uid
        meta.TransferSyntaxUID = ExplicitVRLittleEndian
        ds = FileDataset(
            f"slice-{k}.dcm",
            Dataset(),
            file_meta=meta,
            preamble=b"\0" * 128,
        )
        ds.SOPClassUID = sop_class
        ds.SOPInstanceUID = sop_instance_uid
        ds.StudyInstanceUID = study_uid
        ds.SeriesInstanceUID = series_uid
        ds.FrameOfReferenceUID = frame_uid
        ds.PatientID = "PHANTOM-1"
        ds.PatientName = "Phantom^Test"
        ds.PatientBirthDate = ""
        ds.PatientSex = ""
        ds.AccessionNumber = ""
        ds.StudyID = "1"
        ds.StudyDate = "20260101"
        ds.StudyTime = "120000"
        ds.Modality = "CT"
        ds.Rows = rows
        ds.Columns = cols
        ds.PixelSpacing = [float(spacing[1]), float(spacing[0])]  # (row, col)
        ds.SliceThickness = float(spacing[2])
        ds.ImageOrientationPatient = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0]
        # Slice origin shifts only along z for our identity orientation.
        ds.ImagePositionPatient = [
            float(origin[0]),
            float(origin[1]),
            float(origin[2] + k * spacing[2]),
        ]
        ds.InstanceNumber = k + 1
        ds.RescaleSlope = 1
        ds.RescaleIntercept = 0
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.PixelRepresentation = 1
        slice_arr = np.zeros((rows, cols), dtype=np.int16)
        ds.PixelData = slice_arr.tobytes()
        datasets.append(ds)
    return datasets


def _two_organ_masks(reference: sitk.Image) -> list[LabeledMask]:
    shape = sitk.GetArrayFromImage(reference).shape
    spleen = _binary_sphere(shape, (4, 12, 12), 4)
    liver = _binary_sphere(shape, (4, 20, 20), 6)
    return [
        _make_label(1, "spleen", spleen, reference),
        _make_label(2, "liver", liver, reference),
    ]


def test_stack_to_multiclass_assigns_unique_ids() -> None:
    reference = _reference_volume()
    shape = sitk.GetArrayFromImage(reference).shape
    spleen = _binary_sphere(shape, (4, 12, 12), 3)
    liver = _binary_sphere(shape, (4, 20, 20), 5)

    stacked = _stack_to_multiclass(
        [
            _make_label(1, "spleen", spleen, reference),
            _make_label(2, "liver", liver, reference),
        ],
        reference,
    )
    arr = sitk.GetArrayFromImage(stacked)
    assert arr.dtype == np.uint16
    assert set(np.unique(arr).tolist()) == {0, 1, 2}
    # Each non-empty mask must contribute at least one voxel.
    assert (arr == 1).any()
    assert (arr == 2).any()


def test_order_masks_puts_largest_first() -> None:
    """Smaller structures must win where labels overlap.

    `_stack_to_multiclass` lets later masks overwrite earlier ones, so the
    ordering is what decides the outcome in an overlap — not a cosmetic detail.
    """
    reference = _reference_volume()
    shape = sitk.GetArrayFromImage(reference).shape
    small = _make_label(1, "small", _binary_sphere(shape, (4, 12, 12), 3), reference)
    large = _make_label(2, "large", _binary_sphere(shape, (4, 12, 12), 6), reference)

    ordered = _order_masks([small, large])
    assert [m.name for m in ordered] == ["large", "small"]

    arr = sitk.GetArrayFromImage(_stack_to_multiclass(ordered, reference))
    # The small sphere sits inside the large one; its voxels carry its own id.
    assert (arr[small.array] == 2).all()


def test_build_dicom_seg_round_trips_through_highdicom(tmp_path: Path) -> None:
    from highdicom.seg import segread

    reference = _reference_volume()
    masks = _two_organ_masks(reference)
    source = _make_source_datasets(reference)

    out_path = tmp_path / "segmentation.dcm"
    artifact = build_dicom_seg(
        masks=masks,
        source_datasets=source,
        reference=reference,
        output_path=out_path,
        series_description="Radiolyze total segmentation",
    )
    assert artifact.path == out_path
    assert out_path.is_file()
    assert artifact.label_count == 2
    assert artifact.sop_instance_uid
    assert artifact.series_instance_uid
    # The SEG inherits the StudyInstanceUID from the source CT.
    assert artifact.study_instance_uid == source[0].StudyInstanceUID

    reread = pydicom.dcmread(str(out_path))
    assert reread.Modality == "SEG"
    assert int(reread.NumberOfFrames) > 0
    assert reread.SeriesDescription == "Radiolyze total segmentation"

    # Largest mask first, so the liver is segment 1 and the spleen segment 2.
    segments = reread.SegmentSequence
    assert [s.SegmentLabel for s in segments] == ["liver", "spleen"]
    assert [s.SegmentedPropertyTypeCodeSequence[0].CodeValue for s in segments] == [
        "10200004",  # SCT: Liver
        "78961009",  # SCT: Spleen
    ]
    # Recommended display colour survives the RGB -> CIELab conversion.
    assert all(len(s.RecommendedDisplayCIELabValue) == 3 for s in segments)

    # The decoded label map must match what we handed in, voxel for voxel.
    # This is the assertion a silently-broken writer cannot satisfy.
    seg = segread(str(out_path))
    decoded = seg.get_pixels_by_source_instance(
        source_sop_instance_uids=[ds.SOPInstanceUID for ds in source],
        combine_segments=True,
        relabel=False,
    )
    expected = sitk.GetArrayFromImage(_stack_to_multiclass(_order_masks(masks), reference))
    assert decoded.shape == expected.shape
    np.testing.assert_array_equal(decoded, expected)


def test_build_dicom_seg_rejects_slice_count_mismatch(tmp_path: Path) -> None:
    """highdicom pairs label-map frame i with source_datasets[i] by index.

    A caller that passes a mismatched series would otherwise produce a SEG
    whose frames reference the wrong slices.
    """
    reference = _reference_volume()
    masks = _two_organ_masks(reference)
    source = _make_source_datasets(reference)[:-1]

    with pytest.raises(ValueError, match="source datasets"):
        build_dicom_seg(
            masks=masks,
            source_datasets=source,
            reference=reference,
            output_path=tmp_path / "ignored.dcm",
        )


def test_build_dicom_seg_survives_missing_type2_attributes(tmp_path: Path) -> None:
    """An anonymised series without PatientBirthDate must still export.

    highdicom reads a handful of type 2 attributes off the first source image
    with no fallback, so a stripped series would otherwise fail at export time —
    long after the job looked healthy.
    """
    reference = _reference_volume()
    masks = _two_organ_masks(reference)
    source = _make_source_datasets(reference)
    for attr in ("PatientBirthDate", "PatientSex", "AccessionNumber", "StudyID"):
        for ds in source:
            delattr(ds, attr)

    out_path = tmp_path / "segmentation.dcm"
    build_dicom_seg(
        masks=masks,
        source_datasets=source,
        reference=reference,
        output_path=out_path,
    )
    assert pydicom.dcmread(str(out_path)).Modality == "SEG"
    # The caller's datasets are left as they were.
    assert "PatientBirthDate" not in source[0]


def test_build_dicom_seg_raises_when_highdicom_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    reference = _reference_volume()
    masks = _two_organ_masks(reference)
    real_import = builtins.__import__

    def _block(name, globals=None, locals=None, fromlist=(), level=0):
        if name.startswith("highdicom"):
            raise ImportError("simulated")
        return real_import(name, globals, locals, fromlist, level)

    _resolve_highdicom.cache_clear()
    monkeypatch.setattr(builtins, "__import__", _block)
    try:
        with pytest.raises(DicomSegUnavailable):
            build_dicom_seg(
                masks=masks,
                source_datasets=_make_source_datasets(reference),
                reference=reference,
                output_path=tmp_path / "ignored.dcm",
            )
    finally:
        monkeypatch.undo()
        _resolve_highdicom.cache_clear()
