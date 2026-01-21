# API Uebersicht

Die UI nutzt HTTP und WebSocket APIs:

- REST: Report Management, QA, Audit
- WebSocket: Live Updates (ASR/AI Status)

## Ist-Stand (Repo)

- FastAPI Orchestrator unter `/api/v1`
- Endpunkte fuer Reports, ASR, Impression, QA, Audit implementiert
- WebSocket Endpoint: `/api/v1/ws`
- CORS konfigurierbar via `CORS_ORIGINS`
- vLLM/MedASR Integration via `VLLM_ENABLED` / `MEDASR_ENABLED`
- Multimodal Inputs: `image_urls` / `image_paths` in Impression und Inference

## Versionierung

Alle Endpunkte sollten unter `/api/v1` gefuehrt werden.

## Auth

- UI/API aktuell ohne Auth (lokale Entwicklung)
- Orthanc DICOMweb via Basic Auth (Default: `orthanc/orthanc`)
- Production: JWT + RBAC, optional mTLS fuer intra-cluster Kommunikation
