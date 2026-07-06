"""Unit tests for the in-memory fallback path of RateLimiter."""

from __future__ import annotations

import time

from app.rate_limiter import RateLimiter


def _memory_limiter(**kwargs) -> RateLimiter:
    limiter = RateLimiter(**kwargs)
    # Force the fallback path regardless of whether a real/fake Redis answered ping().
    limiter._redis_available = False
    return limiter


def test_memory_fallback_allows_up_to_limit_then_denies():
    limiter = _memory_limiter(window_seconds=60)

    for _ in range(3):
        allowed, _remaining, _retry_after = limiter.check("k1", limit=3)
        assert allowed is True

    allowed, remaining, retry_after = limiter.check("k1", limit=3)
    assert allowed is False
    assert remaining == 0
    assert retry_after == 60


def test_memory_fallback_resets_after_window_expires():
    limiter = _memory_limiter(window_seconds=0.2)

    assert limiter.check("k2", limit=1)[0] is True
    assert limiter.check("k2", limit=1)[0] is False

    time.sleep(0.25)

    assert limiter.check("k2", limit=1)[0] is True


def test_memory_fallback_tracks_keys_independently():
    limiter = _memory_limiter(window_seconds=60)

    assert limiter.check("a:/path", limit=1)[0] is True
    # A different key (different client or path) must not share the bucket.
    assert limiter.check("b:/path", limit=1)[0] is True
    assert limiter.check("a:/path", limit=1)[0] is False


def test_cleanup_purges_stale_keys_from_fallback_store():
    limiter = _memory_limiter(window_seconds=0.1, cleanup_interval=0.15)

    limiter.check("stale-key", limit=5)
    assert "stale-key" in limiter._fallback_store

    time.sleep(0.2)

    # Any subsequent check triggers the periodic sweep; use a different key
    # so the stale one isn't refreshed by being looked up directly.
    limiter.check("other-key", limit=5)

    assert "stale-key" not in limiter._fallback_store
    assert "other-key" in limiter._fallback_store


def test_cleanup_keeps_fresh_entries_within_window():
    limiter = _memory_limiter(window_seconds=60, cleanup_interval=0.05)

    limiter.check("fresh-key", limit=5)
    time.sleep(0.1)
    limiter.check("other-key", limit=5)

    # fresh-key is well within its 60s window, so cleanup must not evict it.
    assert "fresh-key" in limiter._fallback_store


def test_cleanup_does_not_run_before_interval_elapses():
    limiter = _memory_limiter(window_seconds=0.05, cleanup_interval=1000)

    limiter.check("k", limit=5)
    time.sleep(0.1)
    last_cleanup_before = limiter._last_cleanup

    limiter.check("other", limit=5)

    # Cleanup interval hasn't elapsed, so the sweep must not have run, even
    # though "k"'s entries are already outside the window.
    assert limiter._last_cleanup == last_cleanup_before
    assert "k" in limiter._fallback_store
