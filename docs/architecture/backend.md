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
- `GET /api/v1/audit-log`

## Implementierung im Repo

- Backend Code: `backend/`
- Docker Setup: `docker-compose.yml` (Frontend + Backend + Postgres)

## DICOM Server (Orthanc)

- DICOM C-STORE fuer Upload
- DICOMweb fuer Viewer und Services
- Optionales Anonymisierungs- und Routing-Plugin

## Inference Services

- **MedASR** fuer Diktat
- **MedGemma** fuer multimodale Bildanalyse
- Optional: LLM fuer Impression (Mistral/Llama)

## Datenhaltung

- PostgreSQL fuer Reports und Audit Events
- Redis fuer Queueing/Cache
