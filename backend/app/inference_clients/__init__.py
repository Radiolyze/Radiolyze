"""High-level inference orchestration, one module per generation family.

Each family builds its own prompt, drives the vLLM client and parses the
structured output. They share no state — only the low-level modules they all
call into:

- ``inference_utils``  – env parsing / value coercion primitives
- ``image_encoder``    – image encoding, manifests, DICOMweb URL rewriting
- ``schema_validator`` – JSON parsing and schema validation
- ``vllm_client``      – the vLLM HTTP client and config

The families themselves:

- ``text``       – impression and free-text summary
- ``localize``   – CXR finding/anatomy bounding boxes
- ``volume``     – whole-series interpretation via the segmenter preprocess
- ``comparison`` – longitudinal current-vs-prior comparison
- ``streaming``  – token-by-token impression over SSE

This package was a single 774-line module until #293. The public names below
are re-exported so that ``from .inference_clients import X`` keeps resolving
for every existing caller. Note that patching a *private* helper through this
namespace no longer reaches the call sites — each family module holds its own
reference — so ``patch("app.inference_clients.volume._vllm_chat_completion")``
is the form that works, naming the module that owns the call.
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
