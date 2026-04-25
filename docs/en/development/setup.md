# Setup

## Prerequisites

- Node.js 18+
- npm or pnpm

## Docker (recommended)

```bash
docker compose up --build
```

### GPU Stack (vLLM + MedASR)

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml --profile gpu up --build
```

### Optional: Whisper ASR (OpenAI-compatible, multilingual)

Instead of MedASR (GPU), a local **faster-whisper** server (`hwdsl2/whisper-server`) can be used. Start the stack with the overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.whisper.yml up --build
```

The service runs on port **9000** (host). On the first start, the image downloads the selected model (default `base` via `WHISPER_MODEL`); this may take a few minutes.

Combining with the GPU overlay (order: GPU first, then Whisper, so that the ASR environment from `docker-compose.whisper.yml` takes precedence):

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml -f docker-compose.whisper.yml --profile gpu up --build
```

Backend variables (set in the overlay, can be overridden in `.env` if needed): `ASR_ENABLED=true`, `ASR_PROVIDER=whisper`, `ASR_OPENAI_BASE_URL=http://whisper-asr:9000`, `ASR_OPENAI_MODEL=whisper-1`, `MEDASR_ENABLED=false`. See also `.env.whisper.example` for optional `WHISPER_*` overrides.

### GPU Stack (AMD ROCm)

```bash
DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile.rocm -t vllm-rocm .
docker compose -f docker-compose.yml -f docker-compose.gpu.yml -f docker-compose.rocm.yml --profile rocm up --build
```

- ROCm device mounts: `/dev/kfd` and `/dev/dri`
- Optional build arg: `PYTORCH_ROCM_ARCH` (e.g. `gfx1100`, `gfx90a`, `gfx942`)

#### Source Build (ROCm)

```bash
git clone https://github.com/vllm-project/vllm.git
cd vllm
export PYTORCH_ROCM_ARCH=gfx1100
export VLLM_TARGET_DEVICE=rocm
pip install -r requirements/rocm.txt
pip install -e . --no-build-isolation
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000/api/v1/health
- Orthanc UI: http://localhost:8042
- DICOMweb: http://localhost:8042/dicom-web

Orthanc login (local):

- User: `orthanc`
- Password: `orthanc`

On the first start, a small DICOM sample is loaded automatically.

## Frontend Env (optional)

- `VITE_INFERENCE_MAX_FRAMES_CURRENT` (default: 16)
- `VITE_INFERENCE_MAX_FRAMES_PRIOR` (default: 8)
- `VITE_INFERENCE_MAX_FRAMES` (legacy fallback)

## Install

```bash
npm install
```

## Dev Server

```bash
npm run dev
```

## Build

```bash
npm run build
```
