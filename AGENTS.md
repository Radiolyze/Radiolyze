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
cp env.dev .env          # once: credentials are required variables, not defaults
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
See `docs/en/development/setup.md` and `docker/compose/whisper.yml`.

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
- DB schema is Alembic-managed (`backend/migrations/`). After changing `backend/app/models.py`, run
  `cd backend && alembic revision --autogenerate -m "..."` and commit the generated migration.
  `docker-compose.yml`'s `migrate` service runs `alembic upgrade head` before `backend`/`worker` start;
  `Base.metadata.create_all` only still runs outside production/staging, for local `uvicorn` convenience.

## Claiming Work (read this before writing code for an issue)

Parallel runs pick the same issue and duplicate each other's work. On
2026-09-03 five runs split `inference_clients.py` and five more did the #117
i18n sweep within six minutes of one another; nine of the ten PRs were thrown
away. Earlier, #233/#236 and #266/#267 were started 1 and 74 seconds apart.
This is the single most expensive failure mode in this repository, and it is
avoidable in one step:

1. **Before writing code for an issue, claim it.** Assign yourself, or post a
   comment saying you are starting and what you intend to change. A claim
   younger than a few hours with no PR is still active.
2. **Check for a claim first.** Read the issue's comments and the open PRs
   (`is:pr is:open` referencing that issue) before starting. If someone has
   claimed it, pick a different issue -- the tracker is not short of them.
3. **Duplicate anyway? Compare, do not merge both.** Check the branches out,
   run the checks, and keep one with the reasons written on the PR. Close the
   rest pointing at the survivor.

The same rule applies to the module list in `[[tool.mypy.overrides]]` and to
any file two issues both name: #292 and #293 overlap on `tasks.py` and
`api/reports.py` deliberately, and the issues say so.

## Project Conventions
- TypeScript strict mode (`"strict": true` in `tsconfig.app.json`; `npm run typecheck` enforces it in CI).
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
