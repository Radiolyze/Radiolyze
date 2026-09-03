"""High-level inference orchestration, one module per job family.

The job families the API and the RQ worker drive share no state, only the layer
they sit in, so each owns a module here:

- ``text``       -- impression and summary from findings text (and optional images)
- ``streaming``  -- the SSE variant of the impression
- ``localize``   -- single-frame bounding-box localization on chest radiographs
- ``volume``     -- volume inference over a segmenter preprocess
- ``comparison`` -- longitudinal comparison of two volume preprocesses

Low-level concerns stay outside the package, shared by all of them:

- ``inference_utils``  -- env parsing / value coercion primitives
- ``image_encoder``    -- image encoding, manifests, DICOMweb URL rewriting
- ``schema_validator`` -- JSON parsing and schema validation
- ``vllm_client``      -- the vLLM HTTP client and config

Public names are re-exported here, so ``from .inference_clients import
generate_volume_inference_summary`` keeps working regardless of which module a
function lives in.

**Patching the vLLM call.** Every module here reaches the client through the
module -- ``vllm_client._vllm_chat_completion(...)`` -- rather than through a
name imported into its own namespace, so ``app.vllm_client`` is the single
place a test patches to intercept the call from any job family. This matters
because of the split: while this was one module, tests could patch
``app.inference_clients._vllm_chat_completion``, which the module re-exported.
That name is deliberately *not* re-exported now. Patching a package-level
alias would no longer reach a call site inside a submodule, so leaving one in
place would turn a stale patch target into a confusing failure at the call
instead of a clear ``AttributeError`` at the patch.
"""

from __future__ import annotations

from ..asr_providers import transcribe_audio
from .comparison import generate_comparison_text
from .localize import UnsupportedModalityError, generate_localize_findings
from .streaming import generate_impression_stream
from .text import generate_impression_text, generate_inference_summary_text
from .volume import generate_volume_inference_summary

__all__ = [
    "UnsupportedModalityError",
    "generate_comparison_text",
    "generate_impression_stream",
    "generate_impression_text",
    "generate_inference_summary_text",
    "generate_localize_findings",
    "generate_volume_inference_summary",
    # Re-exported for app.api.reports / app.services.asr_service, which reach ASR
    # through this module rather than importing app.asr_providers directly.
    "transcribe_audio",
]
