"""Impression generation: the structured call and the SSE streaming variant."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from .. import vllm_client
from ..ai_schemas import ImpressionOutput, get_impression_schema
from ..image_encoder import (
    _build_image_manifest,
    _build_multimodal_content,
    _rewrite_image_urls,
)
from ..inference_utils import (
    _compact_metadata,
    _env_flag,
    _env_float,
    _env_int,
    _normalize_list,
)
from ..mock_logic import generate_impression
from ..prompts import render_prompt_with_metadata
from ..schema_validator import _parse_structured_output
from ._common import _raise_if_schema_invalid, _structured_metadata

logger = logging.getLogger(__name__)


def _build_impression_prompt(
    findings_text: str | None,
    image_manifest: str | None,
) -> tuple[str, dict[str, Any]]:
    return render_prompt_with_metadata(
        "impression",
        {
            "findings_text": (findings_text or "").strip(),
            "image_manifest": image_manifest or "",
        },
    )


def generate_impression_text(
    findings_text: str | None,
    *,
    image_urls: list[str] | None = None,
    image_paths: list[str] | None = None,
    image_refs: list[dict[str, Any]] | None = None,
) -> tuple[str, float, str, dict[str, Any]]:
    findings_text = (findings_text or "").strip()
    has_images = bool(_normalize_list(image_urls) or _normalize_list(image_paths))
    if (not findings_text and not has_images) or not _env_flag("VLLM_ENABLED", False):
        text, confidence = generate_impression(findings_text)
        return text, confidence, "mock-impression-v1", {"provider": "mock"}

    image_manifest = _build_image_manifest(image_urls, image_paths, image_refs)
    model_name = vllm_client._vllm_model_name()
    try:
        start_time = time.monotonic()
        system_prompt, system_meta = render_prompt_with_metadata("system")
        prompt_text, prompt_meta = _build_impression_prompt(findings_text, image_manifest)
        raw_text = vllm_client._vllm_chat_completion(
            prompt_text,
            model_name=model_name,
            system_prompt=system_prompt,
            image_urls=image_urls,
            image_paths=image_paths,
            guided_json_schema=get_impression_schema(),
        )
        text, parse_metadata, evidence_indices, confidence_label = _parse_structured_output(
            raw_text,
            model_type=ImpressionOutput,
            text_key="impression",
            schema_name="impression_output",
            has_images=has_images,
        )
        _raise_if_schema_invalid(parse_metadata)
        latency_ms = int((time.monotonic() - start_time) * 1000)
        confidence = _env_float("VLLM_DEFAULT_CONFIDENCE", 0.0)
        json_metadata = _structured_metadata(
            parse_metadata,
            system_meta=system_meta,
            task=prompt_meta,
            has_images=has_images,
            evidence_indices=evidence_indices,
            confidence_label=confidence_label,
        )
        return (
            text,
            confidence,
            model_name,
            _compact_metadata({"provider": "vllm", "latency_ms": latency_ms, **json_metadata}),
        )
    except Exception as exc:
        logger.warning("vLLM impression failed: %s", exc)
        if _env_flag("VLLM_FALLBACK_TO_MOCK", True):
            text, confidence = generate_impression(findings_text)
            return text, confidence, "mock-impression-v1", {"provider": "mock", "error": str(exc)}
        raise RuntimeError("vLLM impression failed") from exc


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
