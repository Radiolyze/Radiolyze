"""The inference package's mocking seams, pinned.

``app/inference_clients/`` is a package of five independent flows (#293). They
all reach vLLM through the *module object* -- ``vllm_client._vllm_chat_completion(...)``
-- rather than through a name imported into their own globals. That is what
makes a single ``patch("app.vllm_client._vllm_chat_completion")`` intercept
every flow, and what keeps it intercepting when a flow is moved between
modules.

The failure this guards against is quiet, not loud. Before the split,
``inference_clients`` was one module holding ``_vllm_chat_completion`` in its
globals and tests patched it there. Had the package re-exported that name for
compatibility, the patch would still have been *accepted* -- and ignored,
because the flow modules read the client from ``vllm_client``. The mock would
sit unused while the flow made a real HTTP call to the vLLM host: a network
test that reports success without testing anything. So these tests assert both
halves -- that the real seam intercepts, and that the obsolete one is absent
so ``mock.patch`` raises instead of no-opping.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

import app.inference_clients as inference_clients

# Every flow that calls the vLLM chat-completion endpoint, with the arguments
# needed to drive it past its mock short-circuit and up to that call.
_CHAT_COMPLETION_FLOWS = {
    "generate_impression_text": lambda fn: fn("Consolidation in the right lower lobe."),
    "generate_inference_summary_text": lambda fn: fn("Consolidation in the right lower lobe."),
    "generate_localize_findings": lambda fn: fn(
        {"wado_url": "http://orthanc/studies/1/series/2", "series_modality": "CR"}
    ),
    "generate_volume_inference_summary": lambda fn: fn(study_uid="1.2.3", series_uid="1.2.4"),
    "generate_comparison_text": lambda fn: fn(
        current_study_uid="1.2.3",
        current_series_uid="1.2.4",
        prior_study_uid="1.2.5",
        prior_series_uid="1.2.6",
    ),
}

_FAKE_PREPROCESS = {
    "modality": "CT",
    "window_preset": "mediastinum",
    "selected_count": 2,
    "total_count": 10,
    "slices": [{"index": i, "data_url": f"data:image/png;base64,FAKE{i}"} for i in range(1, 3)],
}


@pytest.mark.parametrize("flow_name", sorted(_CHAT_COMPLETION_FLOWS))
def test_patching_vllm_client_intercepts_every_flow(flow_name: str, monkeypatch) -> None:
    """One patch of the real seam must reach all five flows.

    If a flow starts importing ``_vllm_chat_completion`` into its own module
    globals instead of calling it through ``vllm_client``, this fails: the mock
    is never reached and the flow attempts a real HTTP call.
    """
    monkeypatch.setenv("VLLM_ENABLED", "true")
    monkeypatch.setenv("VLLM_FALLBACK_TO_MOCK", "false")

    flow = getattr(inference_clients, flow_name)

    def _no_network(*args, **kwargs):
        raise AssertionError(
            f"{flow_name} reached the network. The patch on "
            "app.vllm_client._vllm_chat_completion did not intercept it."
        )

    with (
        patch(
            "app.segmentation_client.preprocess_for_medgemma",
            return_value=_FAKE_PREPROCESS,
        ),
        # Backstop: if the seam below is bypassed, fail here and now rather than
        # attempting a real request and reporting a DNS or timeout error.
        patch("app.vllm_client.httpx.Client", _no_network),
        patch(
            "app.vllm_client._vllm_chat_completion",
            return_value='{"summary":"s","impression":"i","findings":[],"summary_change":"c"}',
        ) as chat,
    ):
        _CHAT_COMPLETION_FLOWS[flow_name](flow)

    assert chat.called, (
        f"{flow_name} did not route through app.vllm_client._vllm_chat_completion. "
        "It has most likely imported the name into its own module globals, which "
        "makes the shared patch a no-op and lets the flow make a real HTTP call."
    )


def test_obsolete_patch_target_is_absent_rather_than_dead() -> None:
    """``app.inference_clients._vllm_chat_completion`` must not come back.

    Re-exporting it for backwards compatibility would give tests a name that
    accepts a patch and silently fails to apply one. Its absence makes
    ``mock.patch`` raise ``AttributeError``, which is the loud failure.
    """
    assert not hasattr(inference_clients, "_vllm_chat_completion")

    with pytest.raises(AttributeError):
        with patch("app.inference_clients._vllm_chat_completion"):
            pass


def test_public_entry_points_survive_the_package_split() -> None:
    """Call sites import these from ``app.inference_clients``; keep them importable.

    ``tasks.py``, ``services/impression_service.py`` and ``services/asr_service.py``
    all import from the package root, so moving a flow between submodules must
    not change what the root exposes.
    """
    for name in inference_clients.__all__:
        assert hasattr(inference_clients, name), f"{name} is in __all__ but not importable"

    # The names the rest of the backend actually imports today.
    for name in (
        "generate_comparison_text",
        "generate_impression_stream",
        "generate_impression_text",
        "generate_inference_summary_text",
        "generate_localize_findings",
        "generate_volume_inference_summary",
        "transcribe_audio",
    ):
        assert name in inference_clients.__all__
