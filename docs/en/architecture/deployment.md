# Deployment

## Local (Docker Compose)

Recommended services:

- Orthanc (DICOM + DICOMweb)
- FastAPI orchestrator
- GPU worker (Ollama/vLLM)
- PostgreSQL
- Redis
- NGINX reverse proxy

## Current State in the Repo

Docker Compose currently provides:

- Frontend (Vite)
- Backend (FastAPI orchestrator)
- Worker (RQ inference)
- Redis (queue + WS events)
- Orthanc (DICOM + DICOMweb, basic auth)
- Orthanc seeder (sample DICOM import)
- PostgreSQL

GPU services are available as overlays:

- vLLM MedGemma (multimodal) via `docker-compose.gpu.yml`
- MedASR (speech) via `docker-compose.gpu.yml`
- AMD ROCm overlay via `docker-compose.rocm.yml` (image: `vllm-rocm`)

Optional services: NGINX.

### Orthanc Notes

- Default login (local): `orthanc / orthanc`
- DICOMweb root: `/dicom-web`
- Seeder controlled via `ORTHANC_SEED_ENABLED` + `ORTHANC_SEED_URLS`.
  Example (comma-separated):
  `https://github.com/pydicom/pydicom-data/raw/master/data_store/data/CT_small.dcm,https://github.com/pydicom/pydicom-data/raw/master/data_store/data/MR_small.dcm,https://github.com/pydicom/pydicom-data/raw/master/data_store/data/CR_small.dcm`

## Target Environments

- On-premises (hospital network)
- Private cloud / VPC
- Hybrid (viewer local, inference internal)

## 2026 Recommendation: vLLM GPU Worker (Multimodal)

vLLM v1.x fits the existing architecture as a separate GPU worker
(OpenAI-compatible API, multimodal support, PagedAttention).

### Hardware Guidelines

- Minimum: 1x RTX 4090 (24 GB) -> 4B MedGemma + 4 parallel
- Optimal: 1x A100 40 GB -> 8–12 parallel
- Batch: 4x A100 -> 50+ parallel

### Example Start (MedGemma)

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

Note: MedASR should be operated as a separate service.

## Key Configurations

- TLS for all endpoints
- DICOMweb URL in the viewer
- API base URL for the UI
- Audit logging destination
- Internet usage/model updates per operational strategy
