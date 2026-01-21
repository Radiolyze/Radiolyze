from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import redis.asyncio as redis_async

from .mock_logic import utc_now
from .queue import get_redis, get_redis_url
from .ws import ConnectionManager

logger = logging.getLogger(__name__)

DEFAULT_WS_CHANNEL = "ws:events"


def get_ws_channel() -> str:
    return os.getenv("WS_EVENT_CHANNEL", DEFAULT_WS_CHANNEL)


def publish_report_status(report_id: str | None, payload: dict[str, Any]) -> None:
    if not report_id:
        return
    message = {
        "type": "report_status",
        "reportId": report_id,
        "payload": payload,
        "timestamp": utc_now(),
    }
    try:
        get_redis().publish(get_ws_channel(), json.dumps(message))
    except Exception as exc:
        logger.warning("Failed to publish ws event: %s", exc)


async def run_ws_bridge(manager: ConnectionManager) -> None:
    channel = get_ws_channel()
    while True:
        redis_client = None
        pubsub = None
        try:
            redis_client = redis_async.from_url(get_redis_url())
            pubsub = redis_client.pubsub()
            await pubsub.subscribe(channel)
            async for message in pubsub.listen():
                if message is None or message.get("type") != "message":
                    continue
                raw = message.get("data")
                if isinstance(raw, (bytes, bytearray)):
                    raw = raw.decode("utf-8")
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                await manager.broadcast(payload)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("WS bridge error: %s", exc)
            await asyncio.sleep(2)
        finally:
            if pubsub is not None:
                try:
                    await pubsub.unsubscribe(channel)
                    await pubsub.close()
                except Exception:
                    pass
            if redis_client is not None:
                try:
                    await redis_client.close()
                except Exception:
                    pass
