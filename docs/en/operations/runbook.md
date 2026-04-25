# Operations Runbook

## Start/Stop (Docker Compose)

```bash
docker compose up -d
docker compose down
```

## Health Checks

- Orthanc: `GET /api/system` (Basic Auth: `orthanc/orthanc`)
- FastAPI: `GET /api/v1/health`
- Inference: `GET /api/tags` (Ollama) or `/v1/models` (vLLM)

## GPU Worker (vLLM)

Recommended for MedGemma (Multimodal). Key checks:

- `GET /health` or `/v1/models`
- GPU utilization: `nvidia-smi`
- vLLM Metrics: `/metrics` (Prometheus)

## Incident Checklist

1. Check status of the DICOM source
2. Is Orthanc DICOMweb reachable?
3. Is the ASR/Inference worker healthy?
4. Is Audit Logging reachable?
5. Activate UI fallback
