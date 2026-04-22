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

### Optional: Whisper ASR (OpenAI-kompatibel, mehrsprachig)

Statt MedASR (GPU) kann ein lokaler **faster-whisper**-Server (`hwdsl2/whisper-server`) genutzt werden. Dafür den Stack mit Overlay starten:

```bash
docker compose -f docker-compose.yml -f docker-compose.whisper.yml up --build
```

Der Dienst laeuft auf Port **9000** (Host). Beim ersten Start laedt das Image das gewaehlte Modell (Standard `base` ueber `WHISPER_MODEL`); das kann einige Minuten dauern.

Kombination mit GPU-Overlay (Reihenfolge: zuerst GPU, dann Whisper, damit die ASR-Umgebung aus `docker-compose.whisper.yml` gewinnt):

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml -f docker-compose.whisper.yml --profile gpu up --build
```

Backend-Variablen (werden im Overlay gesetzt, bei Bedarf in `.env` ueberschreibbar): `ASR_ENABLED=true`, `ASR_PROVIDER=whisper`, `ASR_OPENAI_BASE_URL=http://whisper-asr:9000`, `ASR_OPENAI_MODEL=whisper-1`, `MEDASR_ENABLED=false`. Siehe auch `.env.whisper.example` fuer optionale `WHISPER_*`-Overrides.

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
