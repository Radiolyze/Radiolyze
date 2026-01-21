from __future__ import annotations

import os

from redis import Redis
from rq import Queue

DEFAULT_REDIS_URL = "redis://localhost:6379/0"
DEFAULT_QUEUE_NAME = "inference"


def get_redis_url() -> str:
    return os.getenv("REDIS_URL", DEFAULT_REDIS_URL)


def get_queue_name() -> str:
    return os.getenv("INFERENCE_QUEUE_NAME", DEFAULT_QUEUE_NAME)


def get_redis() -> Redis:
    return Redis.from_url(get_redis_url())


def get_queue() -> Queue:
    return Queue(get_queue_name(), connection=get_redis())
