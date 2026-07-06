"""Auth enforcement for the segmenter's shared-secret dependency.

``SEGMENTER_API_KEY`` gates every route except ``/health``. Unset (the
default in these tests unless a case opts in) means unauthenticated access
is still allowed -- covered explicitly below so a regression that flips the
open/closed default is caught either way.
"""

from __future__ import annotations

import numpy as np
import pytest
import SimpleITK as sitk
from fastapi.testclient import TestClient

_API_KEY_HEADER = "X-Segmenter-Api-Key"


@pytest.fixture()
def segmenter_app(tmp_path, monkeypatch):
    monkeypatch.setenv("SEGMENTATION_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("SEGMENTER_API_KEY", raising=False)
    from app import dicom_loader
    from app import main as segmenter_main

    async def _fake_fetch(*_args, **_kwargs):
        arr = np.full((8, 16, 16), -500.0, dtype=np.float32)
        image = sitk.GetImageFromArray(arr)
        image.SetSpacing((1.0, 1.0, 1.0))
        return dicom_loader.LoadedVolume(image=image, modality="CT", instance_count=8)

    monkeypatch.setattr(segmenter_main, "fetch_series_volume", _fake_fetch)
    return segmenter_main.app


def test_health_never_requires_a_key(segmenter_app, monkeypatch):
    monkeypatch.setenv("SEGMENTER_API_KEY", "s3cret")
    with TestClient(segmenter_app) as client:
        assert client.get("/health").status_code == 200


def test_requests_allowed_when_key_unconfigured(segmenter_app):
    """No SEGMENTER_API_KEY set: open access (with a logged warning), not a lockout."""
    with TestClient(segmenter_app) as client:
        response = client.get("/jobs/unknown-job")
        assert response.status_code == 404  # reached the handler, not blocked at auth


@pytest.mark.parametrize(
    "method,path,json_body",
    [
        ("POST", "/segment/bone", {"job_id": "x", "study_uid": "1", "series_uid": "2"}),
        ("POST", "/segment/total", {"job_id": "x", "study_uid": "1", "series_uid": "2"}),
        ("GET", "/jobs/x", None),
        ("GET", "/jobs/x/manifest", None),
        ("GET", "/jobs/x/mesh/1", None),
        ("GET", "/jobs/x/mask/1", None),
        ("GET", "/jobs/x/dicom-seg", None),
        ("POST", "/preprocess/medgemma", {"study_uid": "1", "series_uid": "2"}),
    ],
)
def test_rejects_missing_or_wrong_key_when_configured(
    segmenter_app, monkeypatch, method, path, json_body
):
    monkeypatch.setenv("SEGMENTER_API_KEY", "s3cret")
    with TestClient(segmenter_app) as client:
        no_header = client.request(method, path, json=json_body)
        assert no_header.status_code == 401

        wrong_header = client.request(
            method, path, json=json_body, headers={_API_KEY_HEADER: "wrong"}
        )
        assert wrong_header.status_code == 401


def test_accepts_correct_key_when_configured(segmenter_app, monkeypatch):
    monkeypatch.setenv("SEGMENTER_API_KEY", "s3cret")
    with TestClient(segmenter_app) as client:
        response = client.get("/jobs/unknown-job", headers={_API_KEY_HEADER: "s3cret"})
        assert response.status_code == 404  # past auth; 404 because the job doesn't exist
