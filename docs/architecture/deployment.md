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
- Worker (RQ Inference)
- Redis (Queue + WS Events)
- Orthanc (DICOM + DICOMweb, Basic Auth)
- Orthanc Seeder (Sample-DICOM Import)
- PostgreSQL

GPU Services sind als Overlay verfuegbar:

- vLLM MedGemma (Multimodal) via `docker-compose.gpu.yml`
- MedASR (Speech) via `docker-compose.gpu.yml`

Optionale Services: NGINX.

### Orthanc Hinweise

- Default Login (lokal): `orthanc / orthanc`
- DICOMweb Root: `/dicom-web`
- Seeder via `ORTHANC_SEED_ENABLED` + `ORTHANC_SEED_URLS` steuerbar.

## Zielumgebungen

- On-Prem (Krankenhausnetz)
- Private Cloud / VPC
- Hybrid (Viewer lokal, Inference intern)

## Empfehlung 2026: vLLM GPU Worker (Multimodal)

vLLM v1.x passt zur bestehenden Architektur als separater GPU Worker
(OpenAI-kompatible API, Multimodal Support, PagedAttention).

### Hardware Richtwerte

- Minimum: 1x RTX 4090 (24GB) -> 4B MedGemma + 4 parallel
- Optimal: 1x A100 40GB -> 8-12 parallel
- Batch: 4x A100 -> 50+ parallel

### Beispiel-Start (MedGemma)

```bash
vllm serve google/medgemma-1.5-4b-it \
  --quantization gptq \
  --dtype bfloat16 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.85 \
  --trust-remote-code \
  --mm-vision-tower google/siglip-so400m-patch14-384 \
  --mm-enable-flash-attn \
  --enforce-eager \
  --served-model-name medgemma-radiology
```

Hinweis: MedASR sollte als separater Service betrieben werden.

## Wichtige Konfigurationen

- TLS fuer alle Endpunkte
- DICOMweb URL im Viewer
- API Base URL fuer UI
- Audit Logging Ziel
- Internetnutzung/Model-Updates gem. Betriebsstrategie
