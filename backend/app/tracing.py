"""OpenTelemetry distributed tracing setup (GAP-05).

A single, idempotent ``setup_tracing`` is shared by the FastAPI API process
(``app.main``) and the RQ worker process (``app.worker``) so that a request can
be correlated end-to-end across API -> worker -> DB -> downstream HTTP services
(vLLM / MedASR via httpx).

Tracing is opt-in via ``ENABLE_TRACING``; when disabled (the default) every
helper here degrades to a no-op so tests and local runs work without a
collector. All OpenTelemetry imports are guarded so the application keeps
running even if the optional packages are not installed.
"""

from __future__ import annotations

import contextlib
import functools
import logging
import os
from collections.abc import Callable, Iterator
from typing import Any

logger = logging.getLogger(__name__)

try:  # opentelemetry-api ships with the SDK; guard so the app runs without it
    from opentelemetry import trace
    from opentelemetry.trace import Status, StatusCode

    _OTEL_AVAILABLE = True
except ImportError:  # pragma: no cover - only hit when deps are missing
    trace = None  # type: ignore[assignment]
    Status = StatusCode = None  # type: ignore[assignment]
    _OTEL_AVAILABLE = False

_initialized = False

# Default attribute keys lifted off an RQ job payload dict onto its span.
_DEFAULT_ATTR_KEYS = ("job_id", "report_id", "study_id", "model_version")


def _enabled() -> bool:
    return os.getenv("ENABLE_TRACING", "").lower() in {"1", "true", "yes"}


def setup_tracing(service_name: str) -> None:
    """Initialise the global TracerProvider and library instrumentation once.

    Safe to call from every process and multiple times: it is a no-op when
    tracing is disabled, the packages are missing, or it already ran.
    """
    global _initialized
    if _initialized:
        return
    if not _enabled():
        logger.info("Tracing disabled (ENABLE_TRACING unset); skipping OpenTelemetry setup")
        return
    if not _OTEL_AVAILABLE:
        logger.warning(
            "ENABLE_TRACING is set but opentelemetry packages are not installed; skipping"
        )
        return

    try:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import SERVICE_NAME, Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        resource = Resource.create(
            {SERVICE_NAME: os.getenv("OTEL_SERVICE_NAME", service_name)}
        )
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
        trace.set_tracer_provider(provider)

        _instrument_libraries()
        _initialized = True
        logger.info("OpenTelemetry tracing initialised for service %r", service_name)
    except Exception:  # pragma: no cover - defensive; tracing must never crash boot
        logger.exception("Failed to initialise OpenTelemetry tracing")


def _instrument_libraries() -> None:
    """Auto-instrument SQLAlchemy, httpx and Redis (best-effort, per library)."""
    from .db import engine

    try:
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        SQLAlchemyInstrumentor().instrument(engine=engine)
    except Exception:  # pragma: no cover
        logger.exception("SQLAlchemy instrumentation failed")

    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

        HTTPXClientInstrumentor().instrument()
    except Exception:  # pragma: no cover
        logger.exception("httpx instrumentation failed")

    try:
        from opentelemetry.instrumentation.redis import RedisInstrumentor

        RedisInstrumentor().instrument()
    except Exception:  # pragma: no cover
        logger.exception("Redis instrumentation failed")


def instrument_fastapi(app: Any) -> None:
    """Attach FastAPI request instrumentation to ``app`` when tracing is on."""
    if not _enabled() or not _OTEL_AVAILABLE:
        return
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app)
    except Exception:  # pragma: no cover
        logger.exception("FastAPI instrumentation failed")


# ---------------------------------------------------------------------------
# Manual span helpers (always safe, even when tracing is disabled)
# ---------------------------------------------------------------------------
class _NoopSpan:
    def set_attribute(self, *_args: Any, **_kwargs: Any) -> None:
        pass

    def record_exception(self, *_args: Any, **_kwargs: Any) -> None:
        pass

    def set_status(self, *_args: Any, **_kwargs: Any) -> None:
        pass


class _NoopTracer:
    @contextlib.contextmanager
    def start_as_current_span(self, _name: str, **_kwargs: Any) -> Iterator[_NoopSpan]:
        yield _NoopSpan()


def get_tracer(name: str) -> Any:
    """Return a real tracer when OTEL is available, else a no-op tracer."""
    if _OTEL_AVAILABLE:
        return trace.get_tracer(name)
    return _NoopTracer()


def set_current_span_attribute(key: str, value: Any) -> None:
    """Tag the currently active span (no-op when tracing is off)."""
    if not _OTEL_AVAILABLE:
        return
    span = trace.get_current_span()
    if span is not None:
        span.set_attribute(key, value)


def traced_task(
    span_name: str, attr_keys: tuple[str, ...] = _DEFAULT_ATTR_KEYS
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Wrap an RQ task (``func(payload, ...)``) in a span.

    Lifts selected keys off the payload dict onto the span and records any
    raised exception. ``functools.wraps`` preserves ``__name__``/``__module__``
    so RQ still resolves the task by its original dotted path.
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        def wrapper(payload: Any, *args: Any, **kwargs: Any) -> Any:
            tracer = get_tracer(func.__module__)
            with tracer.start_as_current_span(span_name) as span:
                if isinstance(payload, dict):
                    for key in attr_keys:
                        value = payload.get(key)
                        if value is not None:
                            span.set_attribute(f"radiolyze.{key}", str(value))
                try:
                    return func(payload, *args, **kwargs)
                except Exception as exc:
                    span.record_exception(exc)
                    if _OTEL_AVAILABLE and StatusCode is not None:
                        span.set_status(Status(StatusCode.ERROR, str(exc)))
                    raise

        return wrapper

    return decorator
