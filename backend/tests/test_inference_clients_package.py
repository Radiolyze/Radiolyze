"""Contracts the ``app.inference_clients`` package split (#293) has to keep.

Two of them, and both exist because a split can break them without any test
going red:

1. The import path callers use. ``tasks.py``, the service layer and the tests
   all reach the job families through ``app.inference_clients``; moving a
   function into a submodule must not change that.
2. The monkeypatch target. Before the split, ``patch("app.inference_clients.
   _vllm_chat_completion")`` worked because the name was a module global at the
   call site. Once the call sits in a submodule, that patch rebinds a name
   nobody calls -- the test still passes, and the real vLLM client is what runs.
   The job families therefore reach the client through the ``vllm_client``
   module object, so patching it where it is defined takes effect everywhere.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

PUBLIC_SURFACE = [
    "CXR_MODALITIES",
    "LOCALIZE_CXR_ANATOMY_PROMPT",
    "LOCALIZE_CXR_FINDING_PROMPT",
    "UnsupportedModalityError",
    "generate_comparison_text",
    "generate_impression_stream",
    "generate_impression_text",
    "generate_inference_summary_text",
    "generate_localize_findings",
    "generate_volume_inference_summary",
    "transcribe_audio",
]


def test_package_exports_the_names_callers_import() -> None:
    import app.inference_clients as inference_clients

    assert sorted(inference_clients.__all__) == sorted(PUBLIC_SURFACE)
    for name in PUBLIC_SURFACE:
        assert hasattr(inference_clients, name), name


def test_private_helpers_are_not_re_exported() -> None:
    """A patch aimed at the pre-split path must fail loudly, not silently pass.

    ``mock.patch`` raises ``AttributeError`` for a name the target module does
    not have, which is the outcome we want for
    ``app.inference_clients._vllm_chat_completion``: a stale patch that quietly
    rebinds an unused alias would leave the test calling the real client.
    """
    import app.inference_clients as inference_clients

    for name in ("_vllm_chat_completion", "_build_image_manifest", "_env_flag"):
        assert not hasattr(inference_clients, name), name


_MODEL_RESPONSE = (
    '{"impression":"No acute finding.","summary":"No acute finding.",'
    '"summary_change":"No interval change.","findings":[]}'
)

_PREPROCESS: dict[str, Any] = {
    "modality": "CT",
    "window_preset": "mediastinum",
    "strategy": "uniform",
    "selected_count": 2,
    "total_count": 40,
    "resize": 896,
    "slices": [
        {"index": 1, "data_url": "data:image/png;base64,A"},
        {"index": 2, "data_url": "data:image/png;base64,B"},
    ],
}


def _call_impression() -> None:
    from app.inference_clients import generate_impression_text

    generate_impression_text("consolidation right lower lobe")


def _call_summary() -> None:
    from app.inference_clients import generate_inference_summary_text

    generate_inference_summary_text("consolidation right lower lobe")


def _call_localize() -> None:
    from app.inference_clients import generate_localize_findings

    generate_localize_findings({"wado_url": "http://orthanc/foo", "series_modality": "CR"})


def _call_volume() -> None:
    from app.inference_clients import generate_volume_inference_summary

    with patch("app.segmentation_client.preprocess_for_medgemma", return_value=_PREPROCESS):
        generate_volume_inference_summary(study_uid="S", series_uid="SE")


def _call_comparison() -> None:
    from app.inference_clients import generate_comparison_text

    with patch("app.segmentation_client.preprocess_for_medgemma", return_value=_PREPROCESS):
        generate_comparison_text(
            current_study_uid="S1",
            current_series_uid="SE1",
            prior_study_uid="S0",
            prior_series_uid="SE0",
        )


@pytest.mark.parametrize(
    ("family", "invoke"),
    [
        ("impression", _call_impression),
        ("summary", _call_summary),
        ("localize", _call_localize),
        ("volume", _call_volume),
        ("comparison", _call_comparison),
    ],
)
def test_every_job_family_observes_a_patched_vllm_client(
    family: str,
    invoke: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Patching ``app.vllm_client._vllm_chat_completion`` reaches every family.

    With the fallback disabled, a family that ignored the patch would either
    reach the real client and fail on the connection, or return the mock
    provider -- so ``calls == 1`` pins that the double was the code path taken.
    """
    monkeypatch.setenv("VLLM_ENABLED", "true")
    monkeypatch.setenv("VLLM_FALLBACK_TO_MOCK", "false")

    calls: list[str] = []

    def fake_chat(prompt: str, **_kwargs: Any) -> str:
        calls.append(prompt)
        return _MODEL_RESPONSE

    with patch("app.vllm_client._vllm_chat_completion", side_effect=fake_chat):
        invoke()

    assert len(calls) == 1, f"{family} did not go through the patched client"
