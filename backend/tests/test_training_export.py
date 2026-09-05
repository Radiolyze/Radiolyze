"""Pin the training-export HTTP surface and the package split out behind it (#293).

The four `/api/v1/training/*` routes had no test of their own before this file;
`test_auth.py` covered the admin gate on the export and nothing else. These
tests describe the archive as its consumers see it -- which members a format
writes, what the manifest contains, which fields survive anonymisation -- so a
later change to `app/services/training_export/` has to break an expectation
rather than a download nobody runs.
"""

from __future__ import annotations

import io
import json
import zipfile
from datetime import timedelta
from typing import Any
from unittest.mock import patch

import pytest

from app.models import Annotation
from app.services.training_export import group_by_image, image_key
from app.utils.time import utc_now


def _annotation(
    db: Any,
    *,
    ann_id: str,
    study: str = "study-1",
    series: str = "series-1",
    instance: str = "inst-1",
    frame: int = 0,
    label: str = "Nodule",
    category: str | None = "lesion",
    severity: str | None = "moderate",
    verified: bool = True,
    created_offset: int = 0,
) -> Annotation:
    ann = Annotation(
        id=ann_id,
        study_id=study,
        series_id=series,
        instance_id=instance,
        frame_index=frame,
        tool_type="RectangleROI",
        geometry_json={"bounding_box": {"x": 10, "y": 20, "width": 30, "height": 40}},
        label=label,
        category=category,
        severity=severity,
        created_by="user-1",
        created_at=utc_now() + timedelta(seconds=created_offset),
        verified_by="admin-1" if verified else None,
        verified_at=utc_now() if verified else None,
        notes="a note",
        anatomical_region="right upper lobe",
        laterality="right",
    )
    db.add(ann)
    db.commit()
    return ann


@pytest.fixture()
def five_annotations(db: Any) -> None:
    """Five verified annotations over four frames; two share a frame."""
    _annotation(db, ann_id="a1", frame=0, created_offset=0)
    _annotation(db, ann_id="a2", frame=0, label="Effusion", created_offset=1)
    _annotation(db, ann_id="a3", frame=1, created_offset=2)
    _annotation(db, ann_id="a4", frame=2, category="artifact", created_offset=3)
    _annotation(db, ann_id="a5", frame=3, category=None, created_offset=4)


def _export(client: Any, **payload: Any) -> zipfile.ZipFile:
    body = {"verifiedOnly": False, **payload}
    response = client.post("/api/v1/training/export", json=body)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/zip"
    return zipfile.ZipFile(io.BytesIO(response.content))


class _FakeResponse:
    def __init__(self, content: bytes, ok: bool) -> None:
        self.content = content
        self._ok = ok

    def raise_for_status(self) -> None:
        if not self._ok:
            raise RuntimeError("404 Not Found")


class _FakeClient:
    """Stands in for ``httpx.Client``, recording every URL it was asked for."""

    requested: list[str] = []
    fail_urls: set[str] = set()

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    def __enter__(self) -> _FakeClient:
        return self

    def __exit__(self, *args: Any) -> None:
        return None

    def get(self, url: str, headers: dict[str, str] | None = None) -> _FakeResponse:
        type(self).requested.append(url)
        return _FakeResponse(f"png:{url}".encode(), url not in type(self).fail_urls)


@pytest.fixture()
def fake_dicomweb() -> Any:
    _FakeClient.requested = []
    _FakeClient.fail_urls = set()
    with patch("app.services.training_export.images.httpx.Client", _FakeClient):
        yield _FakeClient


# --- keys and grouping ------------------------------------------------------


def test_image_key_is_shared_by_annotations_on_the_same_frame(db: Any) -> None:
    same_a = _annotation(db, ann_id="k1", frame=2)
    same_b = _annotation(db, ann_id="k2", frame=2, label="Other")
    other = _annotation(db, ann_id="k3", frame=3)

    assert image_key(same_a) == image_key(same_b)
    assert image_key(same_a) != image_key(other)
    assert image_key(same_a) == "study-1_series-1_inst-1_2"


def test_group_by_image_keeps_input_order(db: Any) -> None:
    first = _annotation(db, ann_id="g1", frame=1)
    second = _annotation(db, ann_id="g2", frame=0)
    third = _annotation(db, ann_id="g3", frame=1, label="Other")

    groups = group_by_image([first, second, third])

    assert list(groups) == [image_key(first), image_key(second)]
    assert [a.id for a in groups[image_key(first)]] == ["g1", "g3"]


# --- stats and categories ---------------------------------------------------


def test_stats_counts_annotations_studies_and_series(client: Any, db: Any) -> None:
    _annotation(db, ann_id="s1", study="study-1", series="series-1", category="lesion")
    _annotation(db, ann_id="s2", study="study-1", series="series-2", category="lesion")
    _annotation(db, ann_id="s3", study="study-2", series="series-1", category=None, verified=False)

    body = client.get("/api/v1/training/stats").json()

    assert body["totalAnnotations"] == 3
    assert body["verifiedAnnotations"] == 2
    assert body["categories"] == {"lesion": 2, "other": 1}
    assert body["studies"] == 2
    assert body["series"] == 3


def test_stats_filters_by_study_and_verified(client: Any, db: Any) -> None:
    _annotation(db, ann_id="s1", study="study-1")
    _annotation(db, ann_id="s2", study="study-2", verified=False)

    scoped = client.get("/api/v1/training/stats", params={"studyIds": "study-2"}).json()
    assert scoped["totalAnnotations"] == 1

    verified = client.get("/api/v1/training/stats", params={"verifiedOnly": True}).json()
    assert verified["totalAnnotations"] == 1


def test_categories_groups_null_into_other(client: Any, db: Any) -> None:
    _annotation(db, ann_id="c1", category="lesion")
    _annotation(db, ann_id="c2", category="lesion")
    _annotation(db, ann_id="c3", category=None)

    body = client.get("/api/v1/training/categories").json()

    assert sorted(body, key=lambda row: row["category"]) == [
        {"category": "lesion", "count": 2},
        {"category": "other", "count": 1},
    ]


# --- the archive, format by format ------------------------------------------


def test_coco_export_writes_annotations_and_readme(client: Any, five_annotations: None) -> None:
    archive = _export(client, format="coco", splitRatio=0.8)

    assert archive.namelist() == ["annotations/train.json", "annotations/val.json", "README.md"]

    train = json.loads(archive.read("annotations/train.json"))
    # 5 annotations, 0.8 split -> 4 train / 1 val, and the first two share a frame
    assert len(train["annotations"]) == 4
    assert len(train["images"]) == 3
    assert {c["name"] for c in train["categories"]} == {"lesion", "artifact"}
    first = train["annotations"][0]
    assert first["bbox"] == [10, 20, 30, 40]
    assert first["area"] == 1200
    assert first["attributes"]["label"] == "Nodule"

    val = json.loads(archive.read("annotations/val.json"))
    assert len(val["annotations"]) == 1

    readme = archive.read("README.md").decode()
    assert readme.startswith("# COCO Format Dataset")
    assert "Data Capture" not in readme


def test_huggingface_export_writes_jsonl_and_dataset_info(
    client: Any, five_annotations: None
) -> None:
    archive = _export(client, format="huggingface", splitRatio=0.8)

    assert archive.namelist() == [
        "data/train.jsonl",
        "data/val.jsonl",
        "dataset_info.json",
        "README.md",
    ]

    rows = [json.loads(line) for line in archive.read("data/train.jsonl").decode().splitlines()]
    assert len(rows) == 3  # one row per frame, not per annotation
    assert rows[0]["num_objects"] == 2
    assert rows[0]["objects"][0]["bbox"] == [10, 20, 40, 60]  # x, y, x+w, y+h

    info = json.loads(archive.read("dataset_info.json"))
    assert info["splits"] == {"train": {"num_examples": 3}, "validation": {"num_examples": 1}}


def test_radiolyze_export_writes_samples_and_lora_config(
    client: Any, five_annotations: None
) -> None:
    archive = _export(client, format="radiolyze", splitRatio=0.8)

    assert archive.namelist() == ["train.json", "val.json", "lora_config.json", "README.md"]

    samples = json.loads(archive.read("train.json"))
    assert len(samples) == 3
    assert samples[0]["response"] == (
        "Nodule (moderate) right in right upper lobe. Effusion (moderate) right in right upper lobe."
    )
    assert samples[0]["annotations"][0]["bbox"] == [10, 20, 30, 40]  # x, y, w, h

    assert json.loads(archive.read("lora_config.json"))["task_type"] == "CAUSAL_LM"

    readme = archive.read("README.md").decode()
    # The LoRA snippet is handed to whoever unpacks the archive, so it has to be
    # runnable on its own -- it used to carry a relative import of this repo's
    # own `app.utils.time`, and used torch without importing it.
    assert "from ..utils.time" not in readme
    assert "import torch" in readme


def test_export_filename_carries_the_format(client: Any, five_annotations: None) -> None:
    response = client.post(
        "/api/v1/training/export", json={"format": "radiolyze", "verifiedOnly": False}
    )

    disposition = response.headers["content-disposition"]
    assert disposition.startswith("attachment; filename=export_")
    assert disposition.endswith("_radiolyze.zip")


def test_export_rejects_an_empty_selection(client: Any, five_annotations: None) -> None:
    response = client.post(
        "/api/v1/training/export",
        json={"format": "coco", "categories": ["no-such-category"], "verifiedOnly": False},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "No annotations found matching criteria"


def test_export_filters_by_category_and_study(client: Any, five_annotations: None) -> None:
    archive = _export(client, format="coco", categories=["artifact"])
    train = json.loads(archive.read("annotations/train.json"))
    val = json.loads(archive.read("annotations/val.json"))
    assert len(train["annotations"]) + len(val["annotations"]) == 1


# --- anonymisation ----------------------------------------------------------


#: The identifiers `five_annotations` is built from. None of them may survive an
#: anonymized export, in any field, in any format (#329).
RAW_IDS = ("study-1", "series-1", "inst-1")


def _archive_text(archive: zipfile.ZipFile) -> str:
    """Every member name and every non-image byte of the archive, as one string.

    The rendered frames are excluded on purpose: the DICOMweb double answers
    with `png:{url}`, so the *payload* of a real image would be the only place
    the raw ids legitimately appear in this test. Their member names are still
    covered -- those are the paths the dataset files point at.
    """
    parts = list(archive.namelist())
    parts += [
        archive.read(name).decode(errors="replace")
        for name in archive.namelist()
        if not name.endswith(".png")
    ]
    return "\n".join(parts)


def test_anonymize_pseudonymizes_the_identifier_fields(client: Any, five_annotations: None) -> None:
    identified = json.loads(_export(client, format="radiolyze", anonymize=False).read("train.json"))
    anonymized = json.loads(_export(client, format="radiolyze", anonymize=True).read("train.json"))

    assert identified[0]["metadata"]["study_id"] == "study-1"
    metadata = anonymized[0]["metadata"]
    assert metadata["study_id"].startswith("ANON-")
    # series and instance used to be missed: `anonymize_metadata` knew `StudyID`
    # from the DICOM tag list and neither of the other two.
    assert metadata["series_id"].startswith("ANON-")
    assert metadata["instance_id"].startswith("ANON-")
    assert metadata["frame_index"] == 0
    assert metadata["modality"] == "CT"


@pytest.mark.parametrize(
    ("export_format", "member", "read", "key_field"),
    [
        ("radiolyze", "train.json", json.loads, "id"),
        (
            "huggingface",
            "data/train.jsonl",
            lambda raw: [json.loads(line) for line in raw.decode().splitlines()],
            "image_id",
        ),
    ],
)
def test_anonymize_builds_the_sample_key_from_the_pseudonymized_ids(
    client: Any,
    five_annotations: None,
    export_format: str,
    member: str,
    read: Any,
    key_field: str,
) -> None:
    """The key is the identifier, so it is built from pseudonyms like everything else.

    It used to be the raw `study_series_instance_frame` string in both formats
    that anonymize: `anonymize_annotation` pseudonymized the fields it knew by
    name, and the key was not one of them. Now `image_key()` builds it from
    `frame_ids()`, so the key still joins against the ids in the same sample.
    """
    samples = read(_export(client, format=export_format, anonymize=True).read(member))
    ids = samples[0] if key_field == "image_id" else samples[0]["metadata"]

    assert samples[0][key_field] == (
        f"{ids['study_id']}_{ids['series_id']}_{ids['instance_id']}_{ids['frame_index']}"
    )
    assert samples[0][key_field].startswith("ANON-")


def test_anonymized_radiolyze_export_still_resolves_its_images(
    client: Any, five_annotations: None
) -> None:
    """`image_path` and `wado_url` address the frame the sample is actually on.

    Both used to be rebuilt from top-level `study_id`/`series_id`/`instance_id`,
    which this format keeps under `metadata` -- so they came back built from
    empty strings (`images/___0.png`) and every sample claimed frame 1.
    """
    samples = json.loads(_export(client, format="radiolyze", anonymize=True).read("train.json"))

    first = samples[0]
    metadata = first["metadata"]
    assert first["image_path"] == f"images/{first['id']}.png"
    assert first["wado_url"] == (
        f"/wado-rs/studies/{metadata['study_id']}/series/{metadata['series_id']}"
        f"/instances/{metadata['instance_id']}/frames/1/rendered"
    )
    # ...and the frame number follows the frame, rather than being 1 throughout.
    assert samples[1]["metadata"]["frame_index"] == 1
    assert samples[1]["wado_url"].endswith("/frames/2/rendered")


def test_coco_export_anonymizes_its_image_entries(client: Any, five_annotations: None) -> None:
    """COCO used to have no anonymization path at all.

    Its `anonymize=True` branch stripped `created_by`/`verified_by` from the
    `attributes` map -- two keys its own builder never writes -- so the filter
    removed nothing while the DICOM identifiers sat untouched on every `images`
    entry.
    """
    train = json.loads(
        _export(client, format="coco", anonymize=True).read("annotations/train.json")
    )

    image = train["images"][0]
    assert image["study_id"].startswith("ANON-")
    assert image["series_id"].startswith("ANON-")
    assert image["instance_id"].startswith("ANON-")
    assert image["file_name"] == (
        f"{image['study_id']}_{image['series_id']}_{image['instance_id']}_{image['frame_index']}.png"
    )
    # The attributes the old branch filtered are still what the builder writes.
    assert set(train["annotations"][0]["attributes"]) == {
        "label",
        "severity",
        "tool_type",
        "verified",
        "notes",
    }


@pytest.mark.parametrize("export_format", ["coco", "huggingface", "radiolyze"])
def test_no_raw_identifier_survives_an_anonymized_export(
    client: Any, five_annotations: None, fake_dicomweb: Any, export_format: str
) -> None:
    """The assurance the switch's name makes, asserted over the whole archive.

    This is the test that was missing: each of the three defects above showed up
    in a different field of a different format, and one scan across all three
    finds all of them.
    """
    anonymized = _archive_text(
        _export(client, format=export_format, anonymize=True, includeImages=True)
    )

    for raw in RAW_IDS:
        assert raw not in anonymized


@pytest.mark.parametrize("export_format", ["coco", "huggingface", "radiolyze"])
def test_an_identified_export_still_carries_the_raw_identifiers(
    client: Any, five_annotations: None, fake_dicomweb: Any, export_format: str
) -> None:
    """The counterpart of the scan above: `anonymize=False` is what it says too.

    Without this, the scan would keep passing if a format stopped exporting its
    identifiers altogether.
    """
    identified = _archive_text(
        _export(client, format=export_format, anonymize=False, includeImages=True)
    )

    for raw in RAW_IDS:
        assert raw in identified


# --- the manifest and the rendered frames -----------------------------------


def test_manifest_lists_one_entry_per_frame_with_its_splits(
    client: Any, five_annotations: None
) -> None:
    body = client.post("/api/v1/training/manifest", json={"verifiedOnly": False}).json()

    assert body["total"] == 4  # four frames behind five annotations
    assert "status" not in body
    entry = body["images"][0]
    assert entry["id"] == "study-1_series-1_inst-1_0"
    assert entry["image_path"] == "images/study-1_series-1_inst-1_0.png"
    assert entry["frame_number"] == entry["frame_index"] + 1
    assert entry["wado_url"].endswith("/instances/inst-1/frames/1/rendered")
    assert [e["splits"] for e in body["images"]] == [["train"], ["train"], ["train"], ["val"]]


def test_manifest_limit_truncates_but_keeps_the_total(client: Any, five_annotations: None) -> None:
    body = client.post("/api/v1/training/manifest", json={"verifiedOnly": False, "limit": 2}).json()

    assert body["total"] == 4
    assert len(body["images"]) == 2


def test_manifest_check_images_reports_per_entry_status(
    client: Any, five_annotations: None, fake_dicomweb: Any
) -> None:
    first_url = client.post("/api/v1/training/manifest", json={"verifiedOnly": False}).json()[
        "images"
    ][0]["wado_url"]
    fake_dicomweb.fail_urls = {first_url}

    body = client.post(
        "/api/v1/training/manifest", json={"verifiedOnly": False, "checkImages": True}
    ).json()

    assert body["status"] == {"ok": 3, "error": 1}
    failed, *rest = body["images"]
    assert failed["status"] == "error" and "404" in failed["error"]
    assert all(e["status"] == "ok" and e["sha256"] and e["bytes"] for e in rest)


def test_export_with_images_fetches_each_frame_once(
    client: Any, five_annotations: None, fake_dicomweb: Any
) -> None:
    archive = _export(client, format="coco", includeImages=True, anonymize=False)

    # Four frames behind five annotations, and the status pass and the archive
    # write share one fetch each rather than requesting the frame twice.
    assert len(fake_dicomweb.requested) == 4
    assert len(set(fake_dicomweb.requested)) == 4

    manifest = json.loads(archive.read("images/manifest.json"))
    assert manifest["status"] == {"ok": 4, "error": 0}
    for entry in manifest["images"]:
        assert archive.read(entry["image_path"]) == f"png:{entry['wado_url']}".encode()
        assert entry["bytes"] == len(archive.read(entry["image_path"]))

    assert "## Data Capture" in archive.read("README.md").decode()


def test_anonymized_export_fetches_the_real_frames_under_pseudonymized_names(
    client: Any, five_annotations: None, fake_dicomweb: Any
) -> None:
    """The archive's members are pseudonyms; the PACS is still asked for the real ids.

    These are the two halves the manifest has to keep apart: `wado_url` is
    published into the archive and must not identify anything, while the frame
    behind it can only be fetched under its real identifiers.
    """
    archive = _export(client, format="coco", includeImages=True, anonymize=True)

    assert all("study-1/series/series-1" in url for url in fake_dicomweb.requested)

    manifest = json.loads(archive.read("images/manifest.json"))
    assert manifest["status"] == {"ok": 4, "error": 0}
    file_names = {
        image["file_name"] for image in json.loads(archive.read("annotations/train.json"))["images"]
    }
    for entry in manifest["images"]:
        assert "ANON-" in entry["wado_url"]
        assert archive.read(entry["image_path"])  # stored under the pseudonymized name
    # ...and those names are the ones the dataset points at.
    stored = {entry["image_path"].removeprefix("images/") for entry in manifest["images"]}
    assert file_names.issubset(stored)  # the val frame is in the manifest but not in train


def test_export_with_images_records_a_failed_frame_without_storing_it(
    client: Any, five_annotations: None, fake_dicomweb: Any
) -> None:
    body = client.post("/api/v1/training/manifest", json={"verifiedOnly": False}).json()
    fake_dicomweb.fail_urls = {body["images"][0]["wado_url"]}

    archive = _export(client, format="coco", includeImages=True)

    manifest = json.loads(archive.read("images/manifest.json"))
    assert manifest["status"] == {"ok": 3, "error": 1}
    missing = manifest["images"][0]
    assert missing["status"] == "error"
    assert missing["image_path"] not in archive.namelist()
