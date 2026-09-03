"""Contracts the ``app.inference_clients`` package split has to keep holding.

Splitting the module into one submodule per job family moved the call sites of the
vLLM client behind a package boundary. Both things this file pins are consequences
of that boundary rather than of any one job family's logic, so they live here and
not next to the volume/comparison tests.
"""

from __future__ import annotations

import importlib
import pkgutil
from unittest.mock import patch

import pytest

import app.inference_clients as inference_clients


def _submodules() -> list[str]:
    return [m.name for m in pkgutil.iter_modules(inference_clients.__path__)]


def test_public_names_are_reachable_from_the_package() -> None:
    """Callers import from ``app.inference_clients``, not from its submodules.

    ``app.tasks``, ``app.services.impression_service`` and ``app.services.asr_service``
    all import from the package, so moving a function between submodules must stay
    invisible to them.
    """
    for name in inference_clients.__all__:
        assert hasattr(inference_clients, name), f"{name} is in __all__ but not importable"


def test_no_submodule_binds_the_vllm_call_into_its_own_namespace() -> None:
    """``app.vllm_client`` stays the one place a test patches the vLLM call.

    A submodule that does ``from ..vllm_client import _vllm_chat_completion`` gets its
    own binding, which a patch of ``app.vllm_client`` no longer reaches -- the call
    would go out over HTTP for real while the test believed it was stubbed. Reaching
    the client as ``vllm_client._vllm_chat_completion(...)`` resolves it per call, so
    one patch target covers every job family.
    """
    offenders = []
    for name in _submodules():
        module = importlib.import_module(f"app.inference_clients.{name}")
        if "_vllm_chat_completion" in vars(module):
            offenders.append(name)
    assert not offenders, (
        f"{offenders} import _vllm_chat_completion by name; call it through the "
        "vllm_client module instead so app.vllm_client stays the single patch point"
    )


def test_the_pre_split_patch_target_is_gone_rather_than_an_alias() -> None:
    """A stale patch target has to fail at the patch, not at the call.

    Before the split, tests patched ``app.inference_clients._vllm_chat_completion``.
    Keeping that name as a package-level alias would let such a patch still succeed
    while no longer intercepting anything.
    """
    with pytest.raises(AttributeError):
        with patch("app.inference_clients._vllm_chat_completion"):
            pass


def test_patching_vllm_client_intercepts_the_impression_family(monkeypatch) -> None:
    """The volume and comparison families are covered in test_volume_inference.py."""
    monkeypatch.setenv("VLLM_ENABLED", "true")
    monkeypatch.setenv("VLLM_FALLBACK_TO_MOCK", "false")

    with patch(
        "app.vllm_client._vllm_chat_completion",
        return_value='{"impression":"No acute cardiopulmonary process."}',
    ) as chat:
        text, _confidence, _model, metadata = inference_clients.generate_impression_text(
            "Clear lungs."
        )

    assert chat.call_count == 1
    assert text == "No acute cardiopulmonary process."
    assert metadata["provider"] == "vllm"


def test_patching_vllm_client_intercepts_the_localize_family(monkeypatch) -> None:
    monkeypatch.setenv("VLLM_ENABLED", "true")
    monkeypatch.setenv("VLLM_FALLBACK_TO_MOCK", "false")

    with patch(
        "app.vllm_client._vllm_chat_completion",
        return_value='{"findings":[{"box_2d":[10,10,20,20],"label":"nodule","confidence":0.8}]}',
    ) as chat:
        findings, _model, metadata = inference_clients.generate_localize_findings(
            {"wado_url": "http://orthanc/foo", "series_modality": "CR"}
        )

    assert chat.call_count == 1
    assert [f["label"] for f in findings] == ["nodule"]
    assert metadata["provider"] == "vllm"
