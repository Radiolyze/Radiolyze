"""Image encoding, prompt manifest building and DICOMweb URL rewriting.

Turns image references (URLs / local paths / structured refs) into the
content payloads and manifests consumed by the vLLM client.
"""

from __future__ import annotations

import base64
import logging
import mimetypes
import os
from pathlib import Path
from typing import Any

from .inference_utils import (
    _as_float,
    _as_int,
    _format_float,
    _normalize_float_list,
    _normalize_list,
)

logger = logging.getLogger(__name__)


def _encode_image_path(path: str) -> str:
    file_path = Path(path)
    if not file_path.is_file():
        raise RuntimeError(f"Image path not found: {path}")
    mime_type, _ = mimetypes.guess_type(file_path.name)
    if not mime_type:
        mime_type = "image/jpeg"
    encoded = base64.b64encode(file_path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _build_multimodal_content(
    prompt: str, image_urls: list[str], image_paths: list[str]
) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for url in image_urls:
        content.append({"type": "image_url", "image_url": {"url": url}})
    for path in image_paths:
        content.append({"type": "image_url", "image_url": {"url": _encode_image_path(path)}})
    return content


def _build_image_manifest(
    image_urls: list[str] | None,
    image_paths: list[str] | None,
    image_refs: list[dict[str, Any]] | None,
) -> str:
    normalized_urls = _normalize_list(image_urls)
    normalized_paths = _normalize_list(image_paths)
    if image_refs:
        lines: list[str] = []
        for index, ref in enumerate(image_refs, start=1):
            if not isinstance(ref, dict):
                continue
            role = ref.get("role")
            if role not in {"current", "prior"}:
                role = None
            study_date = ref.get("study_date") or ref.get("studyDate")
            time_delta_days = ref.get("time_delta_days") or ref.get("timeDeltaDays")
            series_description = ref.get("series_description") or ref.get("seriesDescription")
            series_modality = ref.get("series_modality") or ref.get("seriesModality")
            frame_index = ref.get("frame_index") if "frame_index" in ref else ref.get("frameIndex")
            stack_index = ref.get("stack_index") if "stack_index" in ref else ref.get("stackIndex")
            instance_number = (
                ref.get("instance_number")
                if "instance_number" in ref
                else ref.get("instanceNumber")
            )
            slice_thickness = (
                ref.get("slice_thickness")
                if "slice_thickness" in ref
                else ref.get("sliceThickness")
            )
            spacing_between_slices = (
                ref.get("spacing_between_slices")
                if "spacing_between_slices" in ref
                else ref.get("spacingBetweenSlices")
            )
            pixel_spacing = (
                ref.get("pixel_spacing") if "pixel_spacing" in ref else ref.get("pixelSpacing")
            )

            parts = [f"{index})"]
            if role:
                parts.append(f"role={role}")
            if study_date:
                parts.append(f"study_date={study_date}")
            delta_days = _as_int(time_delta_days)
            if delta_days is not None:
                parts.append(f"time_delta_days={delta_days}")
            if series_description:
                parts.append(f"series={series_description}")
            if series_modality:
                parts.append(f"modality={series_modality}")
            if isinstance(frame_index, int):
                parts.append(f"frame={frame_index}")
            if isinstance(stack_index, int):
                parts.append(f"stack={stack_index}")
            instance_number_value = _as_int(instance_number)
            if instance_number_value is not None:
                parts.append(f"instance={instance_number_value}")
            slice_value = _as_float(slice_thickness)
            if slice_value is not None:
                parts.append(f"slice_thickness={_format_float(slice_value)}")
            spacing_value = _as_float(spacing_between_slices)
            if spacing_value is not None:
                parts.append(f"spacing_between_slices={_format_float(spacing_value)}")
            pixel_values = _normalize_float_list(pixel_spacing)
            if pixel_values and len(pixel_values) >= 2:
                parts.append(
                    "pixel_spacing="
                    f"{_format_float(pixel_values[0])}x{_format_float(pixel_values[1])}"
                )
            lines.append(" ".join(parts))

        if lines:
            return "\n".join(lines)

    if not (normalized_urls or normalized_paths):
        return ""

    url_lines: list[str] = []
    for index in range(len(normalized_urls)):
        url_lines.append(f"{index + 1}) source=url")
    for index in range(len(normalized_paths)):
        url_lines.append(f"{len(url_lines) + index + 1}) source=path")
    return "\n".join(url_lines)


def _dicom_web_base_url() -> str:
    """Get the DICOMweb base URL accessible from the backend/worker."""
    return os.getenv("DICOM_WEB_BASE_URL", "http://orthanc:8042/dicom-web").rstrip("/")


def _dicom_web_base_url_with_auth() -> str:
    """Get the DICOMweb base URL with embedded Basic Auth credentials if configured.

    Returns URL like 'http://user:pass@orthanc:8042/dicom-web' for vLLM to access.
    """
    base_url = _dicom_web_base_url()
    username = os.getenv("DICOM_WEB_USERNAME") or os.getenv("ORTHANC_USERNAME")
    password = os.getenv("DICOM_WEB_PASSWORD") or os.getenv("ORTHANC_PASSWORD")

    if not username or not password:
        return base_url

    # Parse URL and inject credentials
    # URL format: http://host:port/path -> http://user:pass@host:port/path
    if "://" in base_url:
        scheme, rest = base_url.split("://", 1)
        return f"{scheme}://{username}:{password}@{rest}"

    return base_url


def _rewrite_image_url(url: str) -> str:
    """Rewrite frontend image URLs to be accessible from the Docker network.

    Frontend URLs like 'http://localhost:5173/dicom-web/...' need to be
    rewritten to 'http://orthanc:8042/dicom-web/...' for vLLM to access.
    """
    if not url:
        return url

    # Extract the path after /dicom-web/
    dicom_web_markers = ["/dicom-web/", "/dicom-web"]
    for marker in dicom_web_markers:
        idx = url.find(marker)
        if idx != -1:
            path = url[idx + len("/dicom-web") :]
            if path.startswith("/"):
                path = path[1:]
            # Use URL with embedded auth for vLLM access
            new_url = f"{_dicom_web_base_url_with_auth()}/{path}"
            logger.debug(
                "Rewrote image URL: %s -> %s (credentials hidden)",
                url,
                _dicom_web_base_url() + "/" + path,
            )
            return new_url

    # If no dicom-web marker found, return original URL
    return url


def _rewrite_image_urls(urls: list[str] | None) -> list[str]:
    """Rewrite a list of image URLs for backend/vLLM access."""
    if not urls:
        return []
    return [_rewrite_image_url(url) for url in urls]
