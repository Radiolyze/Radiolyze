# Betrieb Runbook

## Start/Stop (Docker Compose)

```bash
docker compose up -d
docker compose down
```

## Health Checks

- Orthanc: `GET /api/system`
- FastAPI: `GET /api/v1/health`
- Inference: `GET /api/tags` (Ollama) oder `/v1/models` (vLLM)

## Incident Checklist

1. Status der DICOM Quelle pruefen
2. Orthanc DICOMweb erreichbar?
3. ASR/Inference Worker gesund?
4. Audit Logging erreichbar?
5. UI Fallback aktivieren
