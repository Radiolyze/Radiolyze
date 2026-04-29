# Radiolyze

Radiology workflow system with AI-assisted report generation, DICOM viewer, speech recognition, and EU AI Act-compliant audit logging.

## Features

- **DICOM Viewer**: Cornerstone.js-based stack viewer with tools (zoom, pan, windowing, measurements), series navigation, and prior studies comparison
- **AI Reporting**: MedGemma multimodal image analysis for automated findings and impressions
- **Speech Input (ASR)**: MedASR or Whisper for medical dictation with live transcription
- **QA Checks**: Automatic quality checks and structured validation
- **Templates & Guidelines**: Institutional templates and guideline hints in the workflow
- **Audit Logging**: Complete traceability of all actions (EU AI Act compliant)
- **DICOM SR Export**: Structured reports as JSON or DICOM SR
- **Batch Processing**: Queue-based reporting for multiple studies
- **3D Tissue Segmentation** (M1): bone-mesh from CT volumes via dedicated `segmenter` microservice + interactive vtk.js mesh viewer with per-tissue toggles. Multi-organ via TotalSegmentator scheduled for M2 — see `docs/components/segmenter.md`.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │ Left Sidebar │  │  DICOM Viewer   │  │    Right Panel     │  │
│  │ Patient/Queue│  │  Cornerstone.js │  │ Findings/QA/Export │  │
│  └──────────────┘  └─────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    WebSocket + REST API
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI Orchestrator)               │
│  Reports │ Inference Queue │ Audit Log │ SR Export │ WebSocket  │
└─────────────────────────────────────────────────────────────────┘
        │                │                │
   ┌────┴────┐     ┌─────┴─────┐    ┌─────┴─────┐
   │ Postgres│     │Redis + RQ │    │  Orthanc  │
   │ Reports │     │  Worker   │    │ Mini-PACS │
   └─────────┘     └───────────┘    └───────────┘
                         │
              ┌──────────┴──────────┐
              │    GPU Services     │
              │ vLLM + MedGemma     │
              │ MedASR / Whisper    │
              └─────────────────────┘
```

## Tech Stack

**Frontend**
- React 18 + TypeScript
- Vite (Build & Dev Server)
- shadcn/ui + Tailwind CSS
- Cornerstone.js (DICOM Rendering)
- i18next (Internationalisation)

**Backend**
- FastAPI (REST API + WebSocket)
- PostgreSQL (Reports, Audit Events)
- Redis + RQ (Job Queue)
- pydicom (DICOM SR)

**DICOM / PACS**
- Orthanc (Mini-PACS, DICOMweb Provider)

**AI Services (optional)**
- vLLM with MedGemma (multimodal analysis)
- MedASR (speech recognition)
- Whisper (self-hosted STT alternative)
- Segmenter (FastAPI + SimpleITK + trimesh, Apache 2.0 TotalSegmentator slated for M2)

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
```

### With GPU (NVIDIA CUDA)

**Prerequisite**: NVIDIA Container Toolkit must be installed.

```bash
# Set up NVIDIA Container Toolkit (once):
sudo ./scripts/setup-nvidia-docker.sh

# Create .env file (see env.example)
# Set HUGGINGFACE_HUB_TOKEN

docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up --build
```

### With GPU (AMD ROCm)

```bash
DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile.rocm -t vllm-rocm .
docker compose -f docker-compose.yml -f docker/compose/gpu.yml -f docker/compose/rocm.yml --profile rocm up --build
```

### With Whisper ASR

```bash
docker compose -f docker-compose.yml -f docker/compose/whisper.yml up --build
```

## Local Development

**Prerequisites**: Node.js 18+, npm

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Start the backend separately (requires Python 3.11+, Redis, PostgreSQL):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Troubleshooting: Cornerstone WASM codecs

If only specific studies fail in the viewer (for example JPEG2000/JPEG-LS/HTJ2K encoded data), check for these console errors:

- `WebAssembly: Response has unsupported MIME type 'text/html' expected 'application/wasm'`
- `failed to match magic number`
- `Error executing method 'decodeTask' on worker 'dicomImageLoader'`

### Quick diagnosis

1. Open browser DevTools > Network and filter by `wasm`.
2. Reload the failing study.
3. Verify all codec files under `/workers/*.wasm` return:
   - `HTTP 200`
   - `Content-Type: application/wasm`
   - binary response body (not HTML fallback page)

### Recovery steps

```bash
# Rebuild worker bundle and codec assets
npm run bundle:worker

# Restart dev server
npm run dev
```

Then hard-reload in the browser (`Ctrl+Shift+R`) with cache disabled in DevTools.

## URLs (local development)

| Service      | URL                                    |
| ------------ | -------------------------------------- |
| Frontend     | http://localhost:5173                  |
| Backend API  | http://localhost:8000/api/v1/health    |
| Orthanc UI   | http://localhost:8042                  |
| DICOMweb     | http://localhost:8042/dicom-web        |

**Orthanc Login** (local development): `orthanc` / `orthanc`

Sample DICOM data is loaded automatically on first start.
Configurable via `ORTHANC_SEED_URLS` (comma-separated).

## Configuration

Environment variables in `.env` (template: `env.example`):

```bash
# Hugging Face token for MedGemma
HUGGINGFACE_HUB_TOKEN=hf_xxx

# Proxy targets for local development without Docker
VITE_API_PROXY_TARGET=http://localhost:8000
VITE_DICOM_WEB_PROXY_TARGET=http://localhost:8042

# DICOMweb authentication
VITE_DICOM_WEB_USERNAME=orthanc
VITE_DICOM_WEB_PASSWORD=orthanc

# Inference frame sampling
VITE_INFERENCE_MAX_FRAMES_CURRENT=16
VITE_INFERENCE_MAX_FRAMES_PRIOR=8
```

## Tests

```bash
# Frontend tests
npm run test

# Lint
npm run lint

# Backend smoke test
./scripts/smoke-backend.sh
```

## Pages / Routes

| Route       | Description                                     |
| ----------- | ----------------------------------------------- |
| `/`         | Main workspace (viewer + reporting)             |
| `/batch`    | Batch dashboard with bulk actions               |
| `/history`  | Audit log and report history                    |
| `/settings` | User settings                                   |

## Docker Directory

```
docker/
├── Dockerfile.frontend     # Production build (nginx)
├── Dockerfile.dev          # Dev container (Vite HMR)
├── Dockerfile.rocm         # AMD ROCm vLLM build
├── nginx.conf              # Nginx configuration
└── compose/
    ├── gpu.yml             # NVIDIA GPU overlay
    ├── rocm.yml            # AMD ROCm overlay
    └── whisper.yml         # Whisper ASR overlay
```

## Compliance (EU AI Act)

The system implements requirements of the EU AI Act for high-risk AI:

- **Art. 12**: Complete audit logging of all AI interactions
- **Art. 13**: Transparency through status indicators and explanations
- **Art. 14**: Human oversight via approval dialogs and editability
- **Art. 15**: Robustness through fallback UI on inference failures

Details: `docs/compliance/`

## Documentation

Markdown sources are in `docs/`. Build the static site with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/):

```bash
pip install -r docs/requirements.txt
python3 -m mkdocs serve    # local with live reload
python3 -m mkdocs build --strict   # output to site/
```

- [Architecture Overview](docs/en/architecture/overview.md)
- [Backend Architecture](docs/en/architecture/backend.md)
- [Frontend Architecture](docs/en/architecture/frontend.md)
- [API Endpoints](docs/en/api/endpoints.md)
- [WebSocket Events](docs/en/api/websocket.md)
- [Development Setup](docs/en/development/setup.md)
- [Workflows](docs/en/workflows/overview.md)

## License

Proprietary – All rights reserved.
