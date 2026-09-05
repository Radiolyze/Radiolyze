"""Contract tests for the ``app.inference_clients`` package surface.

``inference_clients`` was one 774-line module before it became a package with a
module per task family (#293). Two things about that split are easy to break by
accident, and both are pinned here rather than left to be discovered downstream:

1. The import path is public. ``app.tasks`` and two service modules import
   names straight from ``app.inference_clients``; the package has to keep
   answering to exactly those names.
2. The patch target is the *definition* site. The previous module imported the
   vLLM helpers into its own namespace, which made
   ``patch("app.inference_clients._vllm_chat_completion")`` the only target that
   worked -- and tied it to whichever module happened to hold the import line.
   The task modules now reach the client through the module object, so one
   patch of ``app.vllm_client._vllm_chat_completion`` covers every family. That
   only stays true as long as nobody reintroduces a ``from ..vllm_client import
   _vllm_chat_completion``.
"""

from __future__ import annotations

import importlib
from unittest.mock import patch

import pytest

# The names other modules in this codebase import from the package today.
# Sourced from the actual call sites, not from __all__, so that trimming
# __all__ cannot quietly make this test agree with a regression.
PUBLIC_NAMES = [
    # app/tasks.py
    "generate_comparison_text",
    "generate_inference_summary_text",
    "generate_localize_findings",
    "generate_volume_inference_summary",
    # app/services/impression_service.py
    "generate_impression_stream",
    "generate_impression_text",
    # app/services/asr_service.py
    "transcribe_audio",
    # app/api/inference.py and the tests
    "UnsupportedModalityError",
]


@pytest.mark.parametrize("name", PUBLIC_NAMES)
def test_the_package_still_exports_every_name_its_callers_import(name: str) -> None:
    module = importlib.import_module("app.inference_clients")
    assert hasattr(module, name), f"app.inference_clients no longer exports {name!r}"


def test_every_name_in_dunder_all_resolves() -> None:
    module = importlib.import_module("app.inference_clients")
    missing = [name for name in module.__all__ if not hasattr(module, name)]
    assert not missing, f"__all__ lists names the package does not define: {missing}"


@pytest.mark.parametrize(
    ("family", "call", "response"),
    [
        (
            "impression",
            lambda fn: fn("Consolidation in the right lower lobe."),
            '{"impression":"Right lower lobe pneumonia."}',
        ),
        (
            "summary",
            lambda fn: fn("Consolidation in the right lower lobe."),
            '{"summary":"Right lower lobe consolidation."}',
        ),
        (
            "localize",
            lambda fn: fn({"wado_url": "http://orthanc/foo", "series_modality": "CR"}),
            '{"findings":[{"box_2d":[10,10,20,20],"label":"nodule","confidence":0.8}]}',
        ),
    ],
)
def test_patching_the_vllm_client_at_its_definition_reaches_each_task_family(
    monkeypatch: pytest.MonkeyPatch,
    family: str,
    call,
    response: str,
) -> None:
    """One patch of ``app.vllm_client`` intercepts every family in the package.

    Volume and comparison are covered the same way in ``test_volume_inference``.
    """
    monkeypatch.setenv("VLLM_ENABLED", "true")
    monkeypatch.setenv("VLLM_FALLBACK_TO_MOCK", "false")

    functions = {
        "impression": "generate_impression_text",
        "summary": "generate_inference_summary_text",
        "localize": "generate_localize_findings",
    }
    module = importlib.import_module("app.inference_clients")
    fn = getattr(module, functions[family])

    with patch("app.vllm_client._vllm_chat_completion", return_value=response) as chat:
        result = call(fn)

    assert chat.called, (
        f"{functions[family]} did not go through app.vllm_client._vllm_chat_completion -- "
        "the module most likely imported the name instead of the module"
    )
    # provider=='vllm' is the observable half: the mock fallback would say 'mock'.
    assert result[-1]["provider"] == "vllm"


@pytest.mark.parametrize(
    ("has_images", "evidence_indices", "expected_indices", "expected_missing"),
    [
        (True, [1, 3], [1, 3], False),
        (True, None, None, True),
        (True, [], None, True),
        (False, None, None, False),
        (False, [2], [2], False),
    ],
)
def test_evidence_metadata_flags_only_an_image_request_that_cited_nothing(
    has_images: bool,
    evidence_indices: list[int] | None,
    expected_indices: list[int] | None,
    expected_missing: bool,
) -> None:
    """``evidence_missing`` marks a real problem, so it must not fire on text-only jobs.

    Impression, summary and volume each spelled this rule out separately before
    the split and now share one helper -- this is the truth table all three had.
    """
    from app.inference_clients._common import _evidence_metadata

    metadata = _evidence_metadata(
        {"json_parsed": True},
        system_meta={"source": "default"},
        task_meta="impression",
        evidence_indices=evidence_indices,
        confidence_label=None,
        has_images=has_images,
    )

    assert metadata["images_used"] is has_images
    assert metadata.get("evidence_indices") == expected_indices
    assert metadata.get("evidence_missing", False) is expected_missing
    # Everything the caller parsed is carried through untouched.
    assert metadata["json_parsed"] is True
    assert metadata["prompt"] == {"system": {"source": "default"}, "task": "impression"}
    # An absent confidence label adds no key rather than a null one.
    assert "confidence_label" not in metadata
