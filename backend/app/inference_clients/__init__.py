"""High-level inference orchestration, one module per generation flow.

Five flows live here. They share no state, only a vLLM endpoint and a set of
helpers, so each one is a module of its own:

- ``text``        – impression and summary from findings text (+ optional images)
- ``localize``    – single-frame finding/anatomy localization on chest radiographs
- ``volume``      – whole-series inference via the segmenter's slice preprocess
- ``comparison``  – longitudinal current-vs-prior comparison
- ``streaming``   – token-by-token impression streaming over SSE

Lower-level concerns sit outside the package entirely:

- ``inference_utils``  – env parsing / value coercion primitives
- ``image_encoder``    – image encoding, manifests, DICOMweb URL rewriting
- ``schema_validator`` – JSON parsing and schema validation
- ``vllm_client``      – the vLLM HTTP client and config
- ``segmentation_client`` – the segmenter HTTP client

This module re-exports the public entry points, so callers keep importing
``from .inference_clients import generate_impression_text`` as before.

Patching in tests
-----------------
The two network boundaries are ``app.vllm_client._vllm_chat_completion`` and
``app.segmentation_client.preprocess_for_medgemma``. **Patch them at those
modules, not here.** Every flow reaches the vLLM client through the module
object (``vllm_client._vllm_chat_completion(...)``) rather than through a name
imported into its own namespace, precisely so that one patch covers all five
flows and keeps working when a flow moves between modules.

Before this package existed, ``inference_clients`` was a single module that
imported ``_vllm_chat_completion`` into its own globals, and tests patched
``app.inference_clients._vllm_chat_completion``. That name is deliberately
**not** re-exported here. Re-exporting it would leave a name that accepts a
patch and then has no effect -- the flows would go on making real HTTP calls
with the mock sitting unused, turning a network test into a silent
false positive. Without the re-export, ``mock.patch`` raises ``AttributeError``
instead, which is the failure mode you want. ``tests/test_inference_seams.py``
pins this.
"""

from __future__ import annotations

from ..asr_providers import transcribe_audio
from .comparison import generate_comparison_text
from .localize import (
    CXR_MODALITIES,
    LOCALIZE_CXR_ANATOMY_PROMPT,
    LOCALIZE_CXR_FINDING_PROMPT,
    UnsupportedModalityError,
    generate_localize_findings,
)
from .streaming import generate_impression_stream
from .text import generate_impression_text, generate_inference_summary_text
from .volume import generate_volume_inference_summary

__all__ = [
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
