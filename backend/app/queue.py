from __future__ import annotations

import os

from redis import Redis
from rq import Queue, Retry

DEFAULT_REDIS_URL = "redis://localhost:6379/0"
DEFAULT_QUEUE_NAME = "inference"
DEFAULT_RETRY_MAX = 3
DEFAULT_RETRY_INTERVALS = (10, 30, 60)


def get_redis_url() -> str:
    return os.getenv("REDIS_URL", DEFAULT_REDIS_URL)


def get_queue_name() -> str:
    return os.getenv("INFERENCE_QUEUE_NAME", DEFAULT_QUEUE_NAME)


def get_redis() -> Redis:
    return Redis.from_url(get_redis_url())


def get_queue() -> Queue:
    return Queue(get_queue_name(), connection=get_redis())


def get_dead_letter_queue(base_name: str) -> Queue:
    """A dedicated queue that exhausted (retries-exceeded) jobs are routed to.

    No worker ever listens on `failed-*` queues (see ``app.worker``): they
    exist purely as a durable, inspectable record of hard failures so
    operators can see and count them (surfaced via ``/api/v1/metrics``)
    without digging through each source queue's transient RQ
    ``FailedJobRegistry``.
    """
    return Queue(f"failed-{base_name}", connection=get_redis())


def get_retry_max() -> int:
    try:
        return max(1, int(os.getenv("QUEUE_RETRY_MAX", str(DEFAULT_RETRY_MAX))))
    except ValueError:
        return DEFAULT_RETRY_MAX


def get_retry_intervals() -> list[int]:
    raw = os.getenv("QUEUE_RETRY_INTERVALS")
    if not raw:
        return list(DEFAULT_RETRY_INTERVALS)
    try:
        intervals = [max(0, int(part.strip())) for part in raw.split(",") if part.strip()]
    except ValueError:
        return list(DEFAULT_RETRY_INTERVALS)
    return intervals or list(DEFAULT_RETRY_INTERVALS)


def default_retry() -> Retry:
    """Retry policy for transient failures (vLLM/segmenter/DB blips).

    Configurable via ``QUEUE_RETRY_MAX`` / ``QUEUE_RETRY_INTERVALS`` (comma
    separated seconds); defaults to 3 retries with a 10s/30s/60s backoff.
    """
    return Retry(max=get_retry_max(), interval=get_retry_intervals())
