"""High-level inference orchestration, one module per task family.

Each module builds its own prompts, drives the vLLM client and parses the
structured output for one kind of job:

- ``impression``  – the report's impression, blocking and SSE-streamed
- ``summary``     – the narrative findings summary
- ``localize``    – bounding boxes on a chest radiograph
- ``volume``      – whole-series interpretation via the segmenter preprocess
- ``comparison``  – current study against a prior one

Low-level concerns stay outside the package:

- ``inference_utils``  – env parsing / value coercion primitives
- ``image_encoder``    – image encoding, manifests, DICOMweb URL rewriting
- ``schema_validator`` – JSON parsing and schema validation
- ``vllm_client``      – the vLLM HTTP client and config

This module is the public surface: ``from app.inference_clients import
generate_impression_text`` and friends keep working unchanged.

**Patching in tests.** Patch a collaborator where it is *defined*
(``app.vllm_client._vllm_chat_completion``, ``app.segmentation_client
.preprocess_for_medgemma``), not here. The task modules reach the vLLM client
through the module object precisely so that one target covers all of them; a
name re-exported into this façade is not what they call.
"""

from __future__ import annotations

from ..asr_providers import transcribe_audio
from .comparison import _format_slice_manifest, generate_comparison_text
from .impression import (
    _build_impression_prompt,
    generate_impression_stream,
    generate_impression_text,
)
from .localize import (
    CXR_MODALITIES,
    LOCALIZE_CXR_ANATOMY_PROMPT,
    LOCALIZE_CXR_FINDING_PROMPT,
    UnsupportedModalityError,
    generate_localize_findings,
)
from .summary import _build_summary_prompt, generate_inference_summary_text
from .volume import _build_volume_prompt, generate_volume_inference_summary

__all__ = [
    "CXR_MODALITIES",
    "LOCALIZE_CXR_ANATOMY_PROMPT",
    "LOCALIZE_CXR_FINDING_PROMPT",
    "UnsupportedModalityError",
    "_build_impression_prompt",
    "_build_summary_prompt",
    "_build_volume_prompt",
    "_format_slice_manifest",
    "generate_comparison_text",
    "generate_impression_stream",
    "generate_impression_text",
    "generate_inference_summary_text",
    "generate_localize_findings",
    "generate_volume_inference_summary",
    # Re-exported for app.services.asr_service, which reads it from here.
    "transcribe_audio",
]
