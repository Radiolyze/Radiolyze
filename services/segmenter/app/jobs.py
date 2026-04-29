from __future__ import annotations

import asyncio
import logging
import threading
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class JobState:
    job_id: str
    preset: str
    status: str = "queued"
    progress: float = 0.0
    error: str | None = None
    manifest: dict[str, Any] | None = None


class JobRegistry:
    """In-memory job state. The orchestrator (backend) is the system of record;
    this registry only exists so polling clients can read progress before the
    manifest hits disk."""

    def __init__(self) -> None:
        self._jobs: dict[str, JobState] = {}
        self._lock = threading.Lock()

    def create(self, job_id: str, preset: str) -> JobState:
        with self._lock:
            state = JobState(job_id=job_id, preset=preset)
            self._jobs[job_id] = state
            return state

    def get(self, job_id: str) -> JobState | None:
        with self._lock:
            return self._jobs.get(job_id)

    def update(
        self,
        job_id: str,
        *,
        status: str | None = None,
        progress: float | None = None,
        error: str | None = None,
        manifest: dict[str, Any] | None = None,
    ) -> None:
        with self._lock:
            state = self._jobs.get(job_id)
            if not state:
                return
            if status is not None:
                state.status = status
            if progress is not None:
                state.progress = progress
            if error is not None:
                state.error = error
            if manifest is not None:
                state.manifest = manifest


registry = JobRegistry()


async def run_with_progress(
    job_id: str, coroutine: Any, *, on_failure_status: str = "failed"
) -> None:
    try:
        await coroutine
    except Exception as exc:  # noqa: BLE001
        logger.exception("Segmentation job %s failed", job_id)
        registry.update(job_id, status=on_failure_status, error=str(exc))


def run_in_background(loop: asyncio.AbstractEventLoop, coro: Any) -> None:
    """Schedule a coroutine on the running loop without awaiting it."""
    asyncio.run_coroutine_threadsafe(coro, loop)
