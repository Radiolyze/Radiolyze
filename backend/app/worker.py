from __future__ import annotations

from rq import Worker

from .queue import get_queue_name, get_redis
from .tracing import setup_tracing


def main() -> None:
    # Distributed tracing (GAP-05): the worker is a separate process, so it
    # initialises its own TracerProvider (no-op unless ENABLE_TRACING is set).
    setup_tracing("radiolyze-worker")
    queue_name = get_queue_name()
    worker = Worker([queue_name], connection=get_redis())
    worker.work()


if __name__ == "__main__":
    main()
