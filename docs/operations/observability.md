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

Der Orchestrator bietet eine einfache JSON-Metrik unter `/api/v1/metrics` mit:

- `reports_total`
- `reports_by_status`
- `qa_status_counts`
- `inference_job_status_counts`
- `audit_events_total`

## Tracing

Empfohlen: OpenTelemetry fuer Request Traces
