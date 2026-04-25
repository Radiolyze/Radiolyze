# Backend Architektur

## Orchestrator (FastAPI)

Der Orchestrator steuert:

- Report-Erstellung und Versionierung
- ASR Trigger und Inference Pipeline
- QA Checks und Audit Logging
- DICOM SR Export (JSON + Binary Draft)

### Beispiel-Endpunkte

- `POST /api/v1/reports/create`
- `GET /api/v1/reports`
- `GET /api/v1/reports/{report_id}`
- `PATCH /api/v1/reports/{report_id}`
- `POST /api/v1/reports/{report_id}/finalize`
- `GET /api/v1/reports/{report_id}/export-sr?format=json|dicom`
- `POST /api/v1/inference/queue`
- `GET /api/v1/inference/status/{job_id}`
- `GET /api/v1/audit-log`

Vollstaendige aktuelle Liste: [API Endpunkte](../api/endpoints.md).

## Implementierung im Repo

- Backend Code: `backend/`
- Docker Setup: `docker-compose.yml` (Frontend + Backend + Worker + Redis + Postgres + Orthanc)
- GPU Overlay: `docker-compose.gpu.yml` (vLLM MedGemma + MedASR)
- Optional ASR Overlay: `docker-compose.whisper.yml` (lokaler OpenAI-kompatibler Whisper-STT)
- ASR: `ASR_ENABLED` / `ASR_PROVIDER` (`medasr` oder `whisper` + `ASR_OPENAI_*`) oder Legacy `MEDASR_ENABLED`; sonst Mock-Fallback
- Impression/Inference nutzen vLLM/MedGemma wenn aktiviert, sonst Mock-Fallback
- Inference Queue via RQ Worker + Redis, Ergebnisse werden in Postgres persistiert
- WebSocket Status-Events werden ueber Redis PubSub an den API-Server gebridged

## DICOM Server (Orthanc)

- DICOM C-STORE fuer Upload
- DICOMweb fuer Viewer und Services
- Optionales Anonymisierungs- und Routing-Plugin

## Inference Services

- **MedASR** oder **Whisper** (OpenAI-kompatibler HTTP-Dienst) fuer Diktat
- **MedGemma** fuer multimodale Bildanalyse
- Optional: LLM fuer Impression (Mistral/Llama)

### Anbindung (Inference Engine)

- vLLM v1.x als GPU Worker mit OpenAI-kompatibler API
- MedASR als separater Service (OpenAI Audio API kompatibel)
- Multimodal Requests via `/v1/chat/completions` (Text + Bild)
- `image_urls` / `image_paths` fuer multimodale Inputs in Impression + Inference
- `image_urls` sollten auf gerenderte PNG-Frames zeigen (WADO-RS `/frames/{n}/rendered`)
- Modellname/Version und Bildanzahl werden im Audit Log persistiert

## Datenhaltung

- PostgreSQL fuer Reports, Audit Events und Inference Jobs
- Redis fuer Queueing und WebSocket Events
