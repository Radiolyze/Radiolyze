# AGENTS.md

## Project Overview
- Radiology workflow with DICOM viewer, reporting, ASR, AI inference, and QA.
- Frontend: React + TypeScript (Vite, shadcn-ui, Tailwind CSS).
- Backend: FastAPI orchestrator with queue/worker (RQ + Redis) and Postgres.
- DICOM: Orthanc as mini-PACS and DICOMweb provider.

## Repo Structure (key paths)
- `src/`: Frontend (Pages, Components, Hooks, Services)
  - `src/components/Viewer`: DICOM viewer UI
  - `src/components/RightPanel`: Findings/Impression/QA/Templates/Guidelines
  - `src/services`: API, Orthanc, WebSocket, Audit Logger
  - `src/hooks`: ASR, Shortcuts, Report Status Sync
- `backend/`: FastAPI app, worker, queue, models
- `docs/en/`: English documentation (default)
- `docs/de/`: German documentation
- `scripts/`: Smoke tests

## Key Endpoints/Ports (local)
- Frontend: http://localhost:5173
- Backend Health: http://localhost:8000/api/v1/health
- Orthanc UI: http://localhost:8042 (Login: orthanc/orthanc)
- DICOMweb: http://localhost:8042/dicom-web

## Development Setup
### Docker (recommended)
```
docker compose up --build
```

### GPU Stack (vLLM + MedASR)
```
docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up --build
```

### Optional: Whisper ASR (CPU, multilingual)
```
docker compose -f docker-compose.yml -f docker/compose/whisper.yml up --build
```
See `docs/en/development/setup.md` and `docker-compose.whisper.yml`.

### Local Frontend Development
```
npm install
npm run dev
```

## Tests and Checks
- Frontend tests: `npm run test`
- Lint: `npm run lint`
- Backend smoke test: `./scripts/smoke-backend.sh`
  - Optional: `API_BASE_URL=http://localhost:8000 ./scripts/smoke-backend.sh`

## Architecture Notes (brief)
- UI consists of Left Sidebar, Viewer, Right Panel.
- Report state via `useReport`, live updates via WebSocket.
- Backend orchestrates report versioning, ASR, inference, QA, and audit logging.
- Inference runs via RQ worker + Redis; results stored in Postgres.

## Project Conventions
- TypeScript strict mode.
- No new dependencies without review.
- UI must remain dark mode compatible.
- No PHI in logs.
- Small, clear commits.

## Relevant Docs
- `docs/en/architecture/overview.md`
- `docs/en/architecture/backend.md`
- `docs/en/architecture/frontend.md`
- `docs/en/development/setup.md`
- `docs/en/development/testing.md`
- MkDocs: `mkdocs.yml`, `docs/requirements.txt`; Build: `python3 -m mkdocs build --strict`
