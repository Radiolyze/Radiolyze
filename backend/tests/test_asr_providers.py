"""Unit tests for ASR provider helpers."""

from __future__ import annotations

import pytest

from app.asr_providers import normalize_asr_language


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, None),
        ("", None),
        ("  ", None),
        ("de-DE", "de"),
        ("en-US", "en"),
        ("EN", "en"),
        ("fr", "fr"),
        ("invalid!", None),
    ],
)
def test_normalize_asr_language(raw: str | None, expected: str | None) -> None:
    assert normalize_asr_language(raw) == expected
