"""Token-by-token impression streaming over SSE.

This is the one flow that talks to vLLM directly rather than through
``vllm_client._vllm_chat_completion``: the shared client is request/response,
and streaming needs the connection held open. It still takes its base URL,
headers, model name and timeout from ``vllm_client`` so there is one place
where the endpoint is configured.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from .. import vllm_client
from ..image_encoder import _build_image_manifest, _build_multimodal_content, _rewrite_image_urls
from ..inference_utils import _env_flag, _env_float, _env_int, _normalize_list
from ..mock_logic import generate_impression
from ..prompts import render_prompt_with_metadata
from .text import _build_impression_prompt

logger = logging.getLogger(__name__)


async def generate_impression_stream(
    findings_text: str | None,
    *,
    image_urls: list[str] | None = None,
    image_refs: list[dict[str, Any]] | None = None,
) -> Any:
    """Async generator that yields impression text tokens via SSE.

    Each yielded value is a string token chunk. The generator falls back to
    a single-chunk mock when VLLM_ENABLED is false or vLLM is unreachable.
    Caller should use `async for token in generate_impression_stream(...)`.
    """
    findings_text = (findings_text or "").strip()
    has_images = bool(_normalize_list(image_urls))

    if not _env_flag("VLLM_ENABLED", False):
        # Mock fallback: yield the whole mock impression as a single chunk
        text, _ = generate_impression(findings_text)
        yield text
        return

    image_manifest = _build_image_manifest(image_urls, None, image_refs)
    model_name = vllm_client._vllm_model_name()
    url = f"{vllm_client._vllm_base_url()}/chat/completions"
    rewritten_urls = _rewrite_image_urls(image_urls)
    normalized_urls = _normalize_list(rewritten_urls)

    system_prompt, _ = render_prompt_with_metadata("system")
    prompt_text, _ = _build_impression_prompt(findings_text, image_manifest)

    if has_images:
        content: str | list[dict[str, Any]] = _build_multimodal_content(
            prompt_text, normalized_urls, []
        )
    else:
        content = prompt_text

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
        "max_tokens": _env_int("VLLM_MAX_TOKENS", 4096),
        "temperature": _env_float("VLLM_TEMPERATURE", 0.1),
        "top_p": _env_float("VLLM_TOP_P", 0.9),
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=vllm_client._vllm_timeout()) as client:
            async with client.stream(
                "POST", url, json=payload, headers=vllm_client._vllm_headers()
            ) as response:
                response.raise_for_status()
                async for raw_line in response.aiter_lines():
                    line = raw_line.strip()
                    if not line or not line.startswith("data:"):
                        continue
                    data_str = line[len("data:") :].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    token = delta.get("content")
                    if token:
                        yield token
    except Exception as exc:
        logger.warning("vLLM stream failed, falling back to mock: %s", exc)
        text, _ = generate_impression(findings_text)
        yield text
