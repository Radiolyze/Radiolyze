from __future__ import annotations

from typing import Any


def build_output_summary(text: str | None, limit: int = 240) -> str | None:
    if not text:
        return None
    normalized = text.strip()
    if not normalized:
        return None
    return normalized[:limit]


def build_image_metadata(
    image_urls: list[str] | None,
    image_paths: list[str] | None,
    image_refs: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    normalized_urls = [url.strip() for url in (image_urls or []) if url and url.strip()]
    normalized_paths = [path.strip() for path in (image_paths or []) if path and path.strip()]
    count = len(normalized_urls) + len(normalized_paths)
    refs_count = len(image_refs or [])
    if count == 0:
        return {"image_refs_count": refs_count} if refs_count else {}
    sources = []
    if normalized_urls:
        sources.append("url")
    if normalized_paths:
        sources.append("path")
    metadata: dict[str, Any] = {"image_count": count, "image_sources": sources}
    if refs_count:
        metadata["image_refs_count"] = refs_count
    return metadata
