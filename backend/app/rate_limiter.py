"""Distributed rate limiter with Redis backend and in-memory fallback."""

from __future__ import annotations

import logging
import time
from collections import defaultdict

logger = logging.getLogger(__name__)


class RateLimiter:
    """Sliding-window rate limiter backed by Redis sorted sets.

    Falls back to an in-memory store when Redis is unavailable, ensuring the
    application never crashes due to a missing Redis connection.
    """

    def __init__(self, window_seconds: int = 60) -> None:
        self._window = window_seconds
        self._fallback_store: dict[str, list[float]] = defaultdict(list)
        self._redis = None
        self._redis_available = False
        self._init_redis()

    def _init_redis(self) -> None:
        try:
            from .queue import get_redis

            r = get_redis()
            r.ping()
            self._redis = r
            self._redis_available = True
            logger.info("Rate limiter using Redis backend")
        except Exception:
            self._redis_available = False
            logger.warning("Rate limiter falling back to in-memory store (Redis unavailable)")

    def check(self, key: str, limit: int) -> tuple[bool, int, int]:
        """Check if the request is within the rate limit.

        Returns (allowed, remaining, retry_after_seconds).
        """
        if self._redis_available:
            try:
                return self._check_redis(key, limit)
            except Exception:
                logger.warning("Redis rate limit check failed, using in-memory fallback")
                self._redis_available = False
        return self._check_memory(key, limit)

    def _check_redis(self, key: str, limit: int) -> tuple[bool, int, int]:
        assert self._redis is not None
        now = time.time()
        window_start = now - self._window
        pipe = self._redis.pipeline()
        redis_key = f"rl:{key}"

        pipe.zremrangebyscore(redis_key, 0, window_start)
        pipe.zcard(redis_key)
        pipe.zadd(redis_key, {f"{now}": now})
        pipe.expire(redis_key, self._window + 1)
        results = pipe.execute()

        current_count = results[1]
        if current_count >= limit:
            # Remove the entry we just added since we're denying
            self._redis.zrem(redis_key, f"{now}")
            return False, 0, self._window

        remaining = max(0, limit - current_count - 1)
        return True, remaining, 0

    def _check_memory(self, key: str, limit: int) -> tuple[bool, int, int]:
        now = time.time()
        window_start = now - self._window
        self._fallback_store[key] = [t for t in self._fallback_store[key] if t > window_start]

        if len(self._fallback_store[key]) >= limit:
            return False, 0, self._window

        self._fallback_store[key].append(now)
        remaining = max(0, limit - len(self._fallback_store[key]))
        return True, remaining, 0
