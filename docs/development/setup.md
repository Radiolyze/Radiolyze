# Setup

## Voraussetzungen

- Node.js 18+
- npm oder pnpm

## Docker (empfohlen)

```bash
docker compose up --build
```

### GPU Stack (vLLM + MedASR)

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml --profile gpu up --build
```

### GPU Stack (AMD ROCm)

```bash
DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile.rocm -t vllm-rocm .
docker compose -f docker-compose.yml -f docker-compose.gpu.yml -f docker-compose.rocm.yml --profile rocm up --build
```

- ROCm Device Mounts: `/dev/kfd` und `/dev/dri`
- Optionale Build-Arg: `PYTORCH_ROCM_ARCH` (z. B. `gfx1100`, `gfx90a`, `gfx942`)

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

Orthanc Login (lokal):

- User: `orthanc`
- Password: `orthanc`

Beim ersten Start wird automatisch ein kleines DICOM Sample geladen.

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
