# API Uebersicht

Die UI nutzt HTTP und WebSocket APIs:

- REST: Report Management, QA, Audit
- WebSocket: Live Updates (ASR/AI Status, UI Refresh)

## Ist-Stand (Repo)

- FastAPI Orchestrator unter `/api/v1`
- Kerndomains: Reports (inkl. Revisionen, PDF/SR-Export, kritische Befunde, Peer Review), ASR, Impression (inkl. Streaming), Inference-Queue, QA-Regeln, Prompts, Templates, Guidelines, Annotationen, Training-Export, Monitoring-Metriken, Audit
- WebSocket: `/api/v1/ws` (optional JWT)
- CORS konfigurierbar via `CORS_ORIGINS`
- vLLM/MedASR optional; Health-Check prueft erreichbare Dienste
- Multimodal: `image_urls` / `image_paths` in Impression und Inference
- Vollstaendige Route-Liste: [API Endpunkte](endpoints.md); maschinenlesbar: OpenAPI unter `/docs` am laufenden Backend

## Versionierung

Alle Endpunkte sollten unter `/api/v1` gefuehrt werden.

## Auth

- API: JWT-Login unter `/api/v1/auth/login`; `AUTH_REQUIRED` steuert, ob geschuetzte Routen einen gueltigen Bearer-Token verlangen (Standard: an)
- WebSocket: bei `AUTH_REQUIRED=true` JWT als Query-Parameter `token` erforderlich
- Orthanc DICOMweb: Basic Auth (lokal typisch `orthanc/orthanc`)
- Production: starke Passwoerter, `ADMIN_PASSWORD` setzen, optional mTLS fuer intra-cluster Kommunikation
