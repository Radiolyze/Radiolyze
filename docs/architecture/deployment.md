# Deployment

## Lokal (Docker Compose)

Empfohlene Services:

- Orthanc (DICOM + DICOMweb)
- FastAPI Orchestrator
- GPU Worker (Ollama/vLLM)
- PostgreSQL
- Redis
- NGINX Reverse Proxy

## Ist-Stand im Repo

Docker Compose liefert aktuell:

- Frontend (Vite)
- Backend (FastAPI Orchestrator)
- Orthanc (DICOM + DICOMweb, Basic Auth)
- Orthanc Seeder (Sample-DICOM Import)
- PostgreSQL

Optionale Services (noch offen): GPU Worker, Redis, NGINX.

### Orthanc Hinweise

- Default Login (lokal): `orthanc / orthanc`
- DICOMweb Root: `/dicom-web`
- Seeder via `ORTHANC_SEED_ENABLED` + `ORTHANC_SEED_URLS` steuerbar.

## Zielumgebungen

- On-Prem (Krankenhausnetz)
- Private Cloud / VPC
- Hybrid (Viewer lokal, Inference intern)

## Wichtige Konfigurationen

- TLS fuer alle Endpunkte
- DICOMweb URL im Viewer
- API Base URL fuer UI
- Audit Logging Ziel
