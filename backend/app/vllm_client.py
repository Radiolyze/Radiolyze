"""HTTP client and configuration for the vLLM (OpenAI-compatible) server."""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from .image_encoder import _build_multimodal_content, _rewrite_image_urls
from .inference_utils import _env_flag, _env_float, _env_int, _normalize_list, _redact_url

logger = logging.getLogger(__name__)


def _vllm_base_url() -> str:
    return os.getenv("VLLM_BASE_URL", "http://vllm-medgemma:8000/v1").rstrip("/")


def _vllm_model_name(model_name: str | None = None) -> str:
    return model_name or os.getenv("VLLM_MODEL_NAME") or "medgemma-radiology"


def _vllm_timeout() -> float:
    return float(_env_int("VLLM_REQUEST_TIMEOUT", 60))


def _vllm_headers() -> dict[str, str]:
    api_key = os.getenv("VLLM_API_KEY")
    if not api_key:
        return {}
    return {"Authorization": f"Bearer {api_key}"}


def _guided_json_enabled() -> bool:
    return _env_flag("VLLM_GUIDED_JSON", True)


def _vllm_chat_completion(
    prompt: str,
    *,
    model_name: str,
    system_prompt: str,
    image_urls: list[str] | None = None,
    image_paths: list[str] | None = None,
    guided_json_schema: dict[str, Any] | None = None,
) -> str:
    url = f"{_vllm_base_url()}/chat/completions"
    # Rewrite frontend URLs to be accessible from Docker network
    rewritten_urls = _rewrite_image_urls(image_urls)
    normalized_urls = _normalize_list(rewritten_urls)
    normalized_paths = _normalize_list(image_paths)
    if rewritten_urls != (image_urls or []):
        logger.info("Rewrote %d image URLs for vLLM access", len(normalized_urls))
    has_images = bool(normalized_urls or normalized_paths)
    content: str | list[dict[str, Any]]
    if has_images:
        content = _build_multimodal_content(prompt, normalized_urls, normalized_paths)
    else:
        content = prompt
    payload: dict[str, Any] = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
        "max_tokens": _env_int("VLLM_MAX_TOKENS", 4096),
        "temperature": _env_float("VLLM_TEMPERATURE", 0.1),
        "top_p": _env_float("VLLM_TOP_P", 0.9),
    }
    # Guided JSON decoding: enforce JSON schema at token-generation level
    if guided_json_schema and _guided_json_enabled():
        payload["response_format"] = {
            "type": "json_object",
            "schema": guided_json_schema,
        }
        logger.debug("Guided JSON enabled for this request")
    logger.info(
        "vLLM request to %s with model=%s, has_images=%s", _redact_url(url), model_name, has_images
    )
    with httpx.Client(timeout=_vllm_timeout()) as client:
        response = client.post(url, json=payload, headers=_vllm_headers())
        response.raise_for_status()
        data = response.json()
    logger.info("vLLM response keys: %s", list(data.keys()))
    # Check for error in response (vLLM may return 200 with error field)
    if data.get("error"):
        logger.error("vLLM returned error: %s", data.get("error"))
        raise RuntimeError(f"vLLM error: {data.get('error')}")
    choices = data.get("choices") or []
    if not choices:
        logger.error(
            "vLLM returned no choices. Full response: %s (truncated to 2000 chars)",
            str(data)[:2000],
        )
        raise RuntimeError("vLLM returned no choices")
    message = choices[0].get("message") or {}
    response_text: str | None = message.get("content")
    finish_reason = choices[0].get("finish_reason")
    logger.info(
        "vLLM finish_reason=%s, content_length=%d",
        finish_reason,
        len(response_text) if response_text else 0,
    )
    if not response_text:
        logger.error("vLLM returned empty content. Choice: %s", choices[0])
        raise RuntimeError("vLLM returned empty content")
    return response_text.strip()
