# Deployment

## Lokal (Docker Compose)

Empfohlene Services:

- Orthanc (DICOM + DICOMweb)
- FastAPI Orchestrator
- GPU Worker (Ollama/vLLM)
- PostgreSQL
- Redis
- NGINX Reverse Proxy

## Zielumgebungen

- On-Prem (Krankenhausnetz)
- Private Cloud / VPC
- Hybrid (Viewer lokal, Inference intern)

## Wichtige Konfigurationen

- TLS fuer alle Endpunkte
- DICOMweb URL im Viewer
- API Base URL fuer UI
- Audit Logging Ziel
