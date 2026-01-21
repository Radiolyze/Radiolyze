from __future__ import annotations

from rq import Worker

from .queue import get_queue_name, get_redis


def main() -> None:
    queue_name = get_queue_name()
    worker = Worker([queue_name], connection=get_redis())
    worker.work()


if __name__ == "__main__":
    main()
