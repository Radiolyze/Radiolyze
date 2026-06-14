"""Unit tests for dicom_client WADO-RS retrieve functions."""

from __future__ import annotations

import base64
from unittest.mock import MagicMock, patch

import httpx
import pytest


# ---------------------------------------------------------------------------
# retrieve_rendered_frame
# ---------------------------------------------------------------------------


def _make_response(status_code: int, content: bytes = b"") -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code
    resp.content = content
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            message=f"HTTP {status_code}",
            request=MagicMock(),
            response=MagicMock(status_code=status_code),
        )
    else:
        resp.raise_for_status.return_value = None
    return resp


@patch("app.dicom_client.httpx.Client")
def test_retrieve_rendered_frame_success(mock_client_cls):
    fake_jpeg = b"\xff\xd8\xff\xe0jpeg"
    mock_get = MagicMock(return_value=_make_response(200, fake_jpeg))
    mock_client_cls.return_value.__enter__.return_value.get = mock_get

    from app.dicom_client import retrieve_rendered_frame

    result = retrieve_rendered_frame("study1", "series1", "instance1", frame=1)

    assert result == fake_jpeg
    call_kwargs = mock_get.call_args
    assert "/studies/study1/series/series1/instances/instance1/frames/1/rendered" in call_kwargs[0][0]
    assert call_kwargs[1]["headers"]["Accept"] == "image/jpeg"


@patch("app.dicom_client.httpx.Client")
def test_retrieve_rendered_frame_http_error(mock_client_cls):
    mock_get = MagicMock(return_value=_make_response(404))
    mock_client_cls.return_value.__enter__.return_value.get = mock_get

    from app.dicom_client import retrieve_rendered_frame

    with pytest.raises(httpx.HTTPStatusError):
        retrieve_rendered_frame("study1", "series1", "instance1")


# ---------------------------------------------------------------------------
# retrieve_and_cache_frame
# ---------------------------------------------------------------------------

FAKE_JPEG = b"\xff\xd8\xff\xe0jpeg_data"
FAKE_DATA_URL = f"data:image/jpeg;base64,{base64.b64encode(FAKE_JPEG).decode('ascii')}"

IMAGE_REF = {
    "study_id": "1.2.3",
    "series_id": "4.5.6",
    "instance_id": "7.8.9",
    "frame_index": 0,
}


@patch("app.dicom_client.retrieve_rendered_frame", return_value=FAKE_JPEG)
def test_retrieve_and_cache_frame_miss(mock_retrieve):
    from app.dicom_client import retrieve_and_cache_frame

    result = retrieve_and_cache_frame(IMAGE_REF)

    mock_retrieve.assert_called_once_with("1.2.3", "4.5.6", "7.8.9", 1)
    assert result == FAKE_DATA_URL


@patch("app.dicom_client.retrieve_rendered_frame", return_value=FAKE_JPEG)
def test_retrieve_and_cache_frame_hit(mock_retrieve):
    from app.queue import get_redis

    from app.dicom_client import retrieve_and_cache_frame

    # Pre-populate cache
    redis_client = get_redis()
    cache_key = "frame:1.2.3:4.5.6:7.8.9:1"
    redis_client.setex(cache_key, 300, FAKE_JPEG)

    result = retrieve_and_cache_frame(IMAGE_REF)

    mock_retrieve.assert_not_called()
    assert result == FAKE_DATA_URL


@patch("app.dicom_client.retrieve_rendered_frame", return_value=FAKE_JPEG)
def test_frame_index_offset(mock_retrieve):
    """frame_index 0 must map to WADO-RS frame=1 (1-based)."""
    from app.dicom_client import retrieve_and_cache_frame

    ref = {**IMAGE_REF, "frame_index": 2}
    retrieve_and_cache_frame(ref)

    _, _, _, frame_arg = mock_retrieve.call_args[0]
    assert frame_arg == 3  # 0-based index 2 → 1-based frame 3
