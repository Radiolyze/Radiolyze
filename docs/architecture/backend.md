# Backend Architektur

## Orchestrator (FastAPI)

Der Orchestrator steuert:

- Report-Erstellung und Versionierung
- ASR Trigger und Inference Pipeline
- QA Checks und Audit Logging
- DICOM SR Erzeugung und Upload

### Beispiel-Endpunkte

- `POST /api/v1/reports/create`
- `GET /api/v1/reports/{report_id}`
- `POST /api/v1/reports/{report_id}/finalize`
- `POST /api/v1/inference/queue`
- `GET /api/v1/inference/status/{job_id}`
- `GET /api/v1/audit-log`

## Implementierung im Repo

- Backend Code: `backend/`
- Docker Setup: `docker-compose.yml` (Frontend + Backend + Worker + Redis + Postgres + Orthanc)
- ASR/Impression/QA nutzen aktuell Mock-Logik als Platzhalter
- Inference Queue via RQ Worker + Redis, Ergebnisse werden in Postgres persistiert
- WebSocket Status-Events werden ueber Redis PubSub an den API-Server gebridged

## DICOM Server (Orthanc)

- DICOM C-STORE fuer Upload
- DICOMweb fuer Viewer und Services
- Optionales Anonymisierungs- und Routing-Plugin

## Inference Services

- **MedASR** fuer Diktat
- **MedGemma** fuer multimodale Bildanalyse
- Optional: LLM fuer Impression (Mistral/Llama)

## Datenhaltung

- PostgreSQL fuer Reports, Audit Events und Inference Jobs
- Redis fuer Queueing und WebSocket Events
