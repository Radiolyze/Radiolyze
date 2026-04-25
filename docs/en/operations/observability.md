# Observability

## Logs

- Application Logs (FastAPI)
- Audit Logs (EU AI Act)
- Viewer Errors (Frontend)

## Metrics

- DICOM Load Time
- ASR Latency
- Inference Latency
- QA Pass/Fail Ratio
- Report Throughput
- vLLM: request_duration_seconds, queue_length, gpu_memory_utilization

### API Snapshot

The orchestrator exposes a simple JSON metrics endpoint at `/api/v1/metrics` with:

- `reports_total`
- `reports_by_status`
- `qa_status_counts`
- `inference_job_status_counts`
- `audit_events_total`

## Drift Monitoring

A simple drift evaluation is available at `/api/v1/monitoring/drift`.
By default, the last 7 days are compared against the preceding 7 days.

Query parameters:

- `window_days` (Default: 7, 1-90)
- `baseline_days` (Default: window_days, 1-365)

The response contains summary values for inference and QA along with deltas and alerts.
Alert thresholds can be configured via ENV:

- `DRIFT_CONFIDENCE_DELTA` (Default: 0.1)
- `DRIFT_INFERENCE_FAILURE_DELTA` (Default: 0.05)
- `DRIFT_QA_PASS_RATE_DELTA` (Default: 0.1)
- `DRIFT_QA_SCORE_DELTA` (Default: 5.0)

A snapshot can optionally be persisted:

- `GET /api/v1/monitoring/drift?persist=true`
- Snapshots can be queried via `/api/v1/monitoring/drift/snapshots`
- Persistence generates audit events (`drift_snapshot_created`, `drift_alert_triggered`)

## Tracing

Recommended: OpenTelemetry for request traces
