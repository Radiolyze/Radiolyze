"""Tests for OpenTelemetry tracing helpers (GAP-05).

These verify the opt-in / no-op behaviour that keeps the app and test suite
working without a collector, and that the manual span helpers behave correctly
when tracing is enabled.
"""

from __future__ import annotations

import pytest

from app import tracing


def test_setup_tracing_noop_when_disabled(monkeypatch):
    """With ENABLE_TRACING unset, setup must not raise or mark itself ready."""
    monkeypatch.delenv("ENABLE_TRACING", raising=False)
    # Reset the module-level guard so the call is actually exercised.
    monkeypatch.setattr(tracing, "_initialized", False)
    tracing.setup_tracing("test-service")
    assert tracing._initialized is False


def test_get_tracer_span_is_safe_without_provider():
    """get_tracer + start_as_current_span must work even with no provider."""
    tracer = tracing.get_tracer("test")
    with tracer.start_as_current_span("unit.span") as span:
        # set_attribute is always callable; should never raise.
        span.set_attribute("radiolyze.k", "v")


def test_traced_task_returns_value_and_lifts_attributes():
    captured: dict = {}

    @tracing.traced_task("task.unit")
    def job(payload):
        captured.update(payload)
        return payload["result"]

    out = job({"job_id": "j1", "report_id": "r1", "result": 42})
    assert out == 42
    assert captured["job_id"] == "j1"


def test_traced_task_reraises_exceptions():
    @tracing.traced_task("task.unit")
    def failing(payload):
        raise ValueError("boom")

    with pytest.raises(ValueError, match="boom"):
        failing({"job_id": "j1"})


def test_inference_endpoint_still_works_with_tracing_helpers(client, sample_report):
    """Regression: tracing wrappers must not break the queue endpoint."""
    resp = client.post(
        "/api/v1/inference/queue",
        json={"report_id": sample_report["id"], "findings_text": "Test findings."},
    )
    assert resp.status_code == 200
    assert "job_id" in resp.json()


def test_tracing_records_span_when_enabled(monkeypatch):
    """With an in-memory exporter wired up, a traced task emits its span."""
    otel_sdk = pytest.importorskip("opentelemetry.sdk.trace")
    from opentelemetry import trace
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
        InMemorySpanExporter,
    )

    # Install an isolated provider with an in-memory exporter.
    exporter = InMemorySpanExporter()
    provider = otel_sdk.TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))

    # get_tracer reads the globally-set provider; override it via the module.
    monkeypatch.setattr(trace, "get_tracer", lambda name: provider.get_tracer(name))

    @tracing.traced_task("task.unit")
    def job(payload):
        return "ok"

    job({"job_id": "j1", "model_version": "m1"})

    spans = exporter.get_finished_spans()
    names = [s.name for s in spans]
    assert "task.unit" in names
