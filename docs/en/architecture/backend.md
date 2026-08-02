# Backend Architecture

## Orchestrator (FastAPI)

The orchestrator manages:

- Report creation and versioning
- ASR triggering and the inference pipeline
- QA checks and audit logging
- DICOM SR export (JSON + binary draft)

### Example Endpoints

- `POST /api/v1/reports/create`
- `GET /api/v1/reports`
- `GET /api/v1/reports/{report_id}`
- `PATCH /api/v1/reports/{report_id}`
- `POST /api/v1/reports/{report_id}/finalize`
- `GET /api/v1/reports/{report_id}/export-sr?format=json|dicom`
- `POST /api/v1/inference/queue`
- `GET /api/v1/inference/status/{job_id}`
- `GET /api/v1/audit-log`

Complete current list: [API Endpoints](../api/endpoints.md).

## Implementation in the Repo

- Backend code: `backend/`
- Docker setup: `docker-compose.yml` (frontend + backend + worker + Redis + Postgres + Orthanc)
- GPU overlay: `docker/compose/gpu.yml` (vLLM MedGemma + MedASR)
- Optional ASR overlay: `docker/compose/whisper.yml` (local OpenAI-compatible Whisper STT)
- ASR: `ASR_ENABLED` / `ASR_PROVIDER` (`medasr` or `whisper` + `ASR_OPENAI_*`) or legacy `MEDASR_ENABLED`; otherwise mock fallback
- Impression/inference use vLLM/MedGemma when enabled, otherwise mock fallback
- Inference queue via RQ worker + Redis; results are persisted in Postgres
- WebSocket status events are bridged to the API server via Redis PubSub

## DICOM Server (Orthanc)

- DICOM C-STORE for upload
- DICOMweb for viewer and services
- Optional anonymization and routing plugin

## Inference Services

- **MedASR** or **Whisper** (OpenAI-compatible HTTP service) for dictation
- **MedGemma** for multimodal image analysis
- Optional: LLM for impression generation (Mistral/Llama)

### Integration (Inference Engine)

- vLLM v1.x as GPU worker with OpenAI-compatible API
- MedASR as a separate service (OpenAI Audio API compatible)
- Multimodal requests via `/v1/chat/completions` (text + image)
- `image_urls` / `image_paths` for multimodal inputs in impression and inference
- `image_urls` should point to rendered PNG frames (WADO-RS `/frames/{n}/rendered`)
- Model name/version and image count are persisted in the audit log

## Data Storage

- PostgreSQL for reports, audit events, and inference jobs
- Redis for queuing and WebSocket events

### Timestamps

Every timestamp column is `timestamptz`, written and read through
`app.utils.sqltypes.UTCDateTime`. Two rules follow from that:

- **Write with `app.utils.time.utc_now()`**, which returns an aware UTC
  `datetime`. Assigning a string to a timestamp column raises. `now_iso()` is
  for payloads that are *not* columns — WebSocket envelopes, JSON metadata,
  response fields with no model behind them.
- **Values read back are always aware and always UTC**, on PostgreSQL and on
  SQLite alike, so they can be compared and subtracted without re-tagging.

The API contract is unaffected: response fields are declared
`app.utils.time.IsoDateTime`, which serializes to an ISO-8601 string with an
explicit `+00:00` offset — the same text these fields carried when the columns
were `String`.

These columns held ISO strings until #102. Comparisons were lexicographic,
which matches chronological order only while every value is UTC, zero-padded
and same-precision; date arithmetic and date-based indexes were unavailable.
