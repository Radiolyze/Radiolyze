# API Endpoints (Current State)

All routes are served by the FastAPI orchestrator under the prefix `/api/v1` (exception: app-level health). The interactive OpenAPI specification is available at `/docs` on the running backend (Swagger UI).

## Health

`GET /api/v1/health`

- Aggregated health check (database, Redis, optional vLLM, MedASR, Orthanc)

## Auth

`POST /api/v1/auth/login`

- Login; returns JWT

`GET /api/v1/auth/me`

- Current user (JWT)

`POST /api/v1/auth/users`

- Create user (protected)

Auth behavior: environment variable `AUTH_REQUIRED` (default `true`). When set to `false`, role checks are bypassed for development.

## Reports

`POST /api/v1/reports/create`

- Creates a report in the database, optionally with a `report_id`

`GET /api/v1/reports?status=...&limit=...&offset=...`

- Lists reports, with optional status filter

`GET /api/v1/reports/by-patient/{patient_id}`

- Reports for a patient

`GET /api/v1/reports/{report_id}`

- Report including status and content

`PATCH /api/v1/reports/{report_id}`

- Updates findings/impression/status; audit events (`findings_saved`, `report_amended`, `report_updated`)

`POST /api/v1/reports/{report_id}/finalize`

- Sign-off; sets status to `finalized`

`GET /api/v1/reports/{report_id}/export-sr?format=json|dicom`

- DICOM SR export (JSON or binary draft); audit event `report_exported`

`POST /api/v1/reports/asr-transcript`

- Audio upload (multipart: `file`, optional `report_id`, optional `language` as BCP-47/ISO hint e.g. `de-DE`); uses MedASR, a configurable OpenAI Audio-compatible service, or mock

`POST /api/v1/reports/generate-impression`

- AI impression; uses vLLM when enabled, otherwise mock

`POST /api/v1/reports/stream-impression`

- Streaming variant of impression generation

`POST /api/v1/reports/qa-check`

- QA checks; updates `qa_status` / `qa_warnings` when `report_id` is provided

`GET /api/v1/reports/{report_id}/revisions`

- Version history (report revisions)

`GET /api/v1/reports/{report_id}/export-pdf`

- PDF export of the report (501 if not available)

`POST /api/v1/reports/{report_id}/check-critical`

- Check for critical findings, create alerts

`GET /api/v1/reports/{report_id}/critical-alerts`

- List of critical alerts

`PATCH /api/v1/reports/{report_id}/critical-alerts/{alert_id}/acknowledge`

- Acknowledge an alert

`POST /api/v1/reports/{report_id}/request-review`

- Request peer review

`GET /api/v1/reports/{report_id}/reviews`

- Peer reviews for a report

`POST /api/v1/reports/{report_id}/reviews/{review_id}/submit`

- Submit a peer review

## Inference

`GET /api/v1/inference/schemas`

- JSON schemas for inference requests

`POST /api/v1/inference/queue`

- Queue a job in RQ; optional multimodal images (`image_urls` / `image_paths`)

`POST /api/v1/inference/localize`

- Localization inference (queued)

`GET /api/v1/inference/status/{job_id}`

- Status and result (DB, fallback RQ job)

## Prompts

`GET /api/v1/prompts`

- Active prompt templates including metadata (`editable`, `maxLength`, `allowedVariables`)

`GET /api/v1/prompts/{prompt_type}`

- Active prompt for `system|summary|impression`

`PUT /api/v1/prompts/{prompt_type}`

- Update a prompt (versioning + activation)

## QA Rules

`GET /api/v1/qa-rules`

- List of QA rules

`POST /api/v1/qa-rules`

- Create a rule

`PATCH /api/v1/qa-rules/{rule_id}`

- Update a rule

`DELETE /api/v1/qa-rules/{rule_id}`

- Delete a rule

## Report Templates

`GET /api/v1/report-templates`

- List templates

`POST /api/v1/report-templates`

- Create a template

`POST /api/v1/report-templates/populate`

- Populate a template with context

`GET /api/v1/report-templates/{template_id}/schema`

- Schema for a template

## Guidelines

`GET /api/v1/guidelines/search`

- Search guidelines

`GET /api/v1/guidelines`

- List guidelines

`POST /api/v1/guidelines`

- Create a guideline

`PATCH /api/v1/guidelines/{guideline_id}`

- Update a guideline

`DELETE /api/v1/guidelines/{guideline_id}`

- Delete a guideline

## Annotations

`POST /api/v1/annotations`

- Create an annotation

`GET /api/v1/annotations`

- List annotations (filtered by query parameters)

`GET /api/v1/annotations/{annotation_id}`

- Single annotation

`PATCH /api/v1/annotations/{annotation_id}`

- Update an annotation

`DELETE /api/v1/annotations/{annotation_id}`

- Delete an annotation

`POST /api/v1/annotations/{annotation_id}/verify`

- Verify an annotation

## Training / Export (Research)

`GET /api/v1/training/stats`

- Export statistics

`POST /api/v1/training/export`

- Data export

`POST /api/v1/training/manifest`

- Generate a manifest

`GET /api/v1/training/categories`

- Categories for training/export

## Monitoring

`GET /api/v1/metrics`

- Metrics (Prometheus-compatible depending on implementation)

`GET /api/v1/monitoring/drift`

- Drift monitoring

`GET /api/v1/monitoring/drift/snapshots`

- Drift snapshots

## Audit

`POST /api/v1/audit-log`

- Write an audit event

`GET /api/v1/audit-log?study_id=...&report_id=...&limit=...&offset=...`

- Read the audit log with filtering and pagination

## WebSocket

`WS /api/v1/ws`

- Live updates; optional query parameter `token` (JWT). A valid token is required when `AUTH_REQUIRED=true`.

See also [WebSocket Events](websocket.md).
