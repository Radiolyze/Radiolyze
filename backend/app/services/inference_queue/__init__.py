"""Queueing and reading back inference jobs.

Extracted from ``app/api/inference.py`` (#293), which was 615 lines of which
four near-identical ~110-line handlers were the bulk. The shared skeleton lives
in ``runner``; each module beside it contributes only what its job type does
differently -- how the input is hashed, what goes in the payload, and which
audit event the request writes.

The routes keep the HTTP surface: paths, response models, and the role guard.
"""

from __future__ import annotations

from ._common import JobSpec, QueueContext
from .comparison import build_comparison_job
from .localize import build_localize_job
from .runner import queue_and_broadcast
from .standard import build_standard_job
from .status import filter_inference_metadata, read_job_status
from .volume import build_volume_job

__all__ = [
    "JobSpec",
    "QueueContext",
    "build_comparison_job",
    "build_localize_job",
    "build_standard_job",
    "build_volume_job",
    "filter_inference_metadata",
    "queue_and_broadcast",
    "read_job_status",
]
