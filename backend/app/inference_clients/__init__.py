"""High-level inference orchestration, one module per job family.

This used to be a single 774-line module holding five job families that shared
the file and nothing else. Each now has its own module (#293):

- ``impression``  – impression text, plus the SSE streaming variant
- ``summary``     – free-text inference summary
- ``localize``    – single-frame CXR localization
- ``volume``      – volume inference via the segmenter preprocess
- ``comparison``  – longitudinal comparison of a current and a prior volume

The package keeps the import path every caller already uses
(``from .inference_clients import generate_comparison_text``), so the split is
invisible to ``tasks.py``, the service layer and the API routes.

Low-level concerns live outside the package, unchanged:

- ``inference_utils``  – env parsing / value coercion primitives
- ``image_encoder``    – image encoding, manifests, DICOMweb URL rewriting
- ``schema_validator`` – JSON parsing and schema validation
- ``vllm_client``      – the vLLM HTTP client and config

**Patching for tests:** patch a helper where it is *defined*, e.g.
``app.vllm_client._vllm_chat_completion``, never through this package. The
modules reach the vLLM client through the module object rather than by binding
its names at import time, precisely so that target works from every job family
and keeps working when a function moves between modules. The private helpers
the single module used to re-export are deliberately not re-exported here, so a
patch aimed at the old path fails loudly instead of silently doing nothing.
"""

from __future__ import annotations

from ..asr_providers import transcribe_audio
from .comparison import generate_comparison_text
from .impression import generate_impression_stream, generate_impression_text
from .localize import (
    CXR_MODALITIES,
    LOCALIZE_CXR_ANATOMY_PROMPT,
    LOCALIZE_CXR_FINDING_PROMPT,
    UnsupportedModalityError,
    generate_localize_findings,
)
from .summary import generate_inference_summary_text
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
