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

## Drift Monitoring

Eine einfache Drift-Auswertung ist unter `/api/v1/monitoring/drift` verfuegbar.
Standardmaessig werden die letzten 7 Tage gegen die vorigen 7 Tage verglichen.

Query-Parameter:

- `window_days` (Default: 7, 1-90)
- `baseline_days` (Default: window_days, 1-365)

Die Antwort enthaelt Summary-Werte fuer Inference und QA sowie Deltas und Alerts.
Alert-Schwellen koennen per ENV konfiguriert werden:

- `DRIFT_CONFIDENCE_DELTA` (Default: 0.1)
- `DRIFT_INFERENCE_FAILURE_DELTA` (Default: 0.05)
- `DRIFT_QA_PASS_RATE_DELTA` (Default: 0.1)
- `DRIFT_QA_SCORE_DELTA` (Default: 5.0)

## Tracing

Empfohlen: OpenTelemetry fuer Request Traces
