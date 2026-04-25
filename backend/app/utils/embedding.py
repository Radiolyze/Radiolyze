"""Embedding client for semantic guideline search.

Calls an OpenAI-compatible embeddings endpoint configured via:
  EMBEDDING_BASE_URL  – e.g. http://text-embeddings-server:8080/v1
  EMBEDDING_MODEL     – default: BAAI/bge-small-en-v1.5
  EMBEDDING_DIM       – default: 768

Returns None when unconfigured or on failure; callers fall back to LIKE search.
"""
from __future__ import annotations

import logging
import math
import os

import httpx

logger = logging.getLogger(__name__)

EMBEDDING_DIM: int = int(os.getenv("EMBEDDING_DIM", "768"))


def _base_url() -> str | None:
    return os.getenv("EMBEDDING_BASE_URL", "").strip() or None


def _model() -> str:
    return os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")


def embed_text(text: str) -> list[float] | None:
    """Generate a vector embedding for *text*.

    Returns a list of floats or None if the service is unconfigured or
    unavailable.  Callers must handle None gracefully (LIKE fallback).
    """
    base_url = _base_url()
    if not base_url:
        return None

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                base_url.rstrip("/") + "/embeddings",
                json={"input": text[:2048], "model": _model()},
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            return resp.json()["data"][0]["embedding"]
    except Exception:
        logger.exception("Embedding request failed (url=%s, model=%s)", base_url, _model())
        return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two equal-length vectors.  Returns 0 on zero-norm."""
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)
