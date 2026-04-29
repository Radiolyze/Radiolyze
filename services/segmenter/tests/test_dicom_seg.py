"""Tests for the DICOM SEG writer.

The first two tests use the real `pydicom-seg` library against synthetic
masks + synthetic source datasets — that's the meaningful integration of
our `_stack_to_multiclass` + template generation against the third-party
writer.

The "missing dep" test patches `_resolve_pydicom_seg` to raise so we don't
have to surgically uninstall the package.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pydicom
import pytest
import SimpleITK as sitk
from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian, generate_uid

from app.dicom_seg import (
    DicomSegUnavailable,
    _set_writer_for_testing,
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

    Each slice carries the metadata pydicom-seg actually consults
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
        ds.is_little_endian = True
        ds.is_implicit_VR = False
        ds.SOPClassUID = sop_class
        ds.SOPInstanceUID = sop_instance_uid
        ds.StudyInstanceUID = study_uid
        ds.SeriesInstanceUID = series_uid
        ds.FrameOfReferenceUID = frame_uid
        ds.PatientID = "PHANTOM-1"
        ds.PatientName = "Phantom^Test"
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


@pytest.fixture(autouse=True)
def reset_writer():
    yield
    _set_writer_for_testing(None, None)


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


def test_build_dicom_seg_writes_real_seg_file(tmp_path: Path) -> None:
    pytest.importorskip("pydicom_seg")
    reference = _reference_volume()
    shape = sitk.GetArrayFromImage(reference).shape
    spleen = _binary_sphere(shape, (4, 12, 12), 4)
    liver = _binary_sphere(shape, (4, 20, 20), 6)
    masks = [
        _make_label(1, "spleen", spleen, reference),
        _make_label(2, "liver", liver, reference),
    ]
    source = _make_source_datasets(reference)

    out_path = tmp_path / "segmentation.dcm"
    artifact = build_dicom_seg(
        masks=masks,
        source_datasets=source,
        reference=reference,
        output_path=out_path,
    )
    assert artifact.path == out_path
    assert out_path.is_file()
    assert artifact.label_count == 2
    assert artifact.sop_instance_uid
    assert artifact.series_instance_uid
    # The SEG inherits the StudyInstanceUID from the source CT.
    assert artifact.study_instance_uid == source[0].StudyInstanceUID

    # Round-trip: reading the file back should give a SEG with two segments.
    reread = pydicom.dcmread(str(out_path))
    assert reread.Modality == "SEG"
    assert int(reread.NumberOfFrames) > 0
    segments = reread.SegmentSequence
    assert len(segments) == 2


def test_build_dicom_seg_raises_when_pydicom_seg_unavailable(tmp_path: Path) -> None:
    reference = _reference_volume()
    masks = [
        _make_label(
            1, "spleen",
            _binary_sphere(sitk.GetArrayFromImage(reference).shape, (4, 12, 12), 3),
            reference,
        ),
    ]
    # Wire a "broken" runner that mimics the missing-dep path. The resolver
    # itself only raises when pydicom_seg cannot be imported, so we patch the
    # template factory to be the missing-piece.
    def _broken_writer(*_a, **_kw):
        raise RuntimeError("must not be called when template factory is missing")

    def _broken_template(*_a, **_kw):
        raise RuntimeError("template missing")

    _set_writer_for_testing(_broken_writer, _broken_template)
    with pytest.raises(RuntimeError):
        build_dicom_seg(
            masks=masks,
            source_datasets=_make_source_datasets(reference),
            reference=reference,
            output_path=tmp_path / "ignored.dcm",
        )


def test_resolve_raises_when_import_blocked(monkeypatch) -> None:
    _set_writer_for_testing(None, None)
    import builtins
    real = builtins.__import__

    def _block(name, globals=None, locals=None, fromlist=(), level=0):
        if name.startswith("pydicom_seg"):
            raise ImportError("simulated")
        return real(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", _block)
    from app.dicom_seg import _resolve_pydicom_seg

    with pytest.raises(DicomSegUnavailable):
        _resolve_pydicom_seg()
