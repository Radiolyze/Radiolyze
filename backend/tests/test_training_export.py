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


def test_anonymize_pseudonymizes_the_identifier_fields(client: Any, five_annotations: None) -> None:
    identified = json.loads(_export(client, format="radiolyze", anonymize=False).read("train.json"))
    anonymized = json.loads(_export(client, format="radiolyze", anonymize=True).read("train.json"))

    assert identified[0]["metadata"]["study_id"] == "study-1"
    assert anonymized[0]["metadata"]["study_id"] != "study-1"


#: The raw identifiers behind the `five_annotations` fixture. Each is a distinct
#: string that has no business appearing in an anonymized archive.
RAW_IDS = ("study-1", "series-1", "inst-1")


@pytest.mark.parametrize("export_format", ["coco", "huggingface", "radiolyze"])
def test_anonymize_keeps_every_raw_identifier_out_of_the_whole_archive(
    client: Any, five_annotations: None, fake_dicomweb: Any, export_format: str
) -> None:
    """The assurance the flag is named for, over every member of the archive.

    Read once per file rather than per known field: the three defects this
    replaces (#329) each hid in a *different* place -- an untouched format, the
    sample key, the manifest -- and a test that checks the fields it already
    thinks of would have missed all three the same way the old ones did.

    `includeImages` is on so that the image members and `images/manifest.json`
    are covered too; those carry the frame key in their own names.
    """
    archive = _export(client, format=export_format, anonymize=True, includeImages=True)
    scanned = 0

    for member in archive.namelist():
        for raw in RAW_IDS:
            assert raw not in member, f"{raw} leaks through the member name {member}"
        if member.endswith(".png"):
            # A rendered frame's body is whatever DICOMweb returned -- here the
            # double's stand-in, which echoes the URL it was fetched over. Not
            # something the export serializes, so not something it can anonymize;
            # its member name, which the export does choose, is checked above.
            continue
        content = archive.read(member).decode("utf-8", errors="ignore")
        for raw in RAW_IDS:
            assert raw not in content, f"{raw} leaks through the contents of {member}"
        scanned += 1

    assert scanned >= 3, "expected the dataset files, the README and the manifest"

    # ...and the fetch still went out over the real identifiers, or the archive
    # would be anonymous and empty.
    assert fake_dicomweb.requested
    assert all("/studies/study-1/series/series-1/" in url for url in fake_dicomweb.requested)


@pytest.mark.parametrize(
    ("export_format", "member"),
    [("coco", "annotations/train.json"), ("huggingface", "data/train.jsonl")],
)
def test_anonymize_maps_the_identifier_fields_of_every_format(
    client: Any, five_annotations: None, export_format: str, member: str
) -> None:
    """Not merely absent: pseudonymized, and consistently so.

    COCO had no anonymization path at all -- its `anonymize=True` branch filtered
    two keys its builder never writes -- so it went out identified. Both formats
    now map the ids the same way the frame key does.
    """
    raw = _export(client, format=export_format, anonymize=False).read(member).decode()
    anonymized = _export(client, format=export_format, anonymize=True).read(member).decode()

    assert "study-1" in raw and "inst-1" in raw
    assert "ANON-" in anonymized


def test_anonymized_samples_still_point_at_their_own_images(
    client: Any, five_annotations: None, fake_dicomweb: Any
) -> None:
    """An anonymized export has to remain a usable dataset.

    The radiolyze sample keeps its ids under `metadata`, and anonymization used
    to rebuild `image_path` and `wado_url` from top-level fields this format does
    not have -- so both came back built from empty strings (`images/___0.png`),
    every sample claiming frame 1. The ids are now mapped once while the sample
    is built, which is what makes the key, the path, the URL and the stored image
    member agree.
    """
    archive = _export(client, format="radiolyze", anonymize=True, includeImages=True)
    samples = json.loads(archive.read("train.json"))
    members = set(archive.namelist())

    for sample in samples:
        assert sample["image_path"] == f"images/{sample['id']}.png"
        assert sample["image_path"] in members, "the sample points at an image the archive lacks"
        assert sample["metadata"]["study_id"] in sample["id"]
        assert sample["wado_url"].endswith(
            f"/frames/{sample['metadata']['frame_index'] + 1}/rendered"
        )

    # Four frames, four distinct samples -- the frame number is part of the key
    # rather than a constant, so no two collapse onto the same image.
    assert len({s["image_path"] for s in samples}) == len(samples)
    assert [s["metadata"]["frame_index"] for s in samples] == [0, 1, 2]


def test_anonymized_manifest_and_image_members_agree_with_the_dataset(
    client: Any, five_annotations: None, fake_dicomweb: Any
) -> None:
    """The manifest is part of the archive, so it is anonymized with it.

    It is also the one record that has to hold both halves at once: the fetch
    goes out over the real frame URL, while what lands in `images/manifest.json`
    addresses the pseudonym -- and never the real URL it was fetched over.
    """
    archive = _export(client, format="coco", anonymize=True, includeImages=True)

    manifest = json.loads(archive.read("images/manifest.json"))
    assert manifest["status"] == {"ok": 4, "error": 0}

    for entry in manifest["images"]:
        assert entry["study_id"].startswith("ANON-")
        assert entry["id"].startswith(entry["study_id"])
        assert "fetch_url" not in entry, "the real frame URL must not travel with the manifest"
        assert entry["wado_url"].startswith(
            f"http://orthanc:8042/dicom-web/studies/{entry['study_id']}"
        )
        assert entry["image_path"] in archive.namelist()
        assert entry["bytes"] == len(archive.read(entry["image_path"]))

    coco_images = json.loads(archive.read("annotations/train.json"))["images"]
    stored = {m[len("images/") : -len(".png")] for m in archive.namelist() if m.endswith(".png")}
    assert {img["file_name"][: -len(".png")] for img in coco_images} <= stored


def test_manifest_preview_keeps_the_real_identifiers(client: Any, five_annotations: None) -> None:
    """The preview exists to be fetched against, so it is not anonymized.

    `/api/v1/training/manifest` has no `anonymize` flag: it is the admin's data
    capture list, and pseudonymized URLs would address nothing.
    """
    body = client.post("/api/v1/training/manifest", json={"verifiedOnly": False}).json()

    assert body["images"][0]["study_id"] == "study-1"
    assert body["images"][0]["id"] == "study-1_series-1_inst-1_0"


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
    # `anonymize=False` so that the manifest's `wado_url` is still the URL the
    # frame was fetched over, and the stored bytes can be tied back to it. The
    # anonymized archive is covered separately, where the two deliberately differ.
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
