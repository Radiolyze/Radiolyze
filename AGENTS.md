# AGENTS.md

## Projektuebersicht
- Radiologie-Workflow mit DICOM Viewer, Reporting, ASR, AI-Inferenz und QA.
- Frontend: React + TypeScript (Vite, shadcn-ui, Tailwind CSS).
- Backend: FastAPI Orchestrator mit Queue/Worker (RQ + Redis) und Postgres.
- DICOM: Orthanc als Mini-PACS und DICOMweb Provider.

## Repo-Struktur (wichtige Pfade)
- `src/`: Frontend (Pages, Components, Hooks, Services)
  - `src/components/Viewer`: DICOM Viewer UI
  - `src/components/RightPanel`: Findings/Impression/QA/Templates/Guidelines
  - `src/services`: API, Orthanc, WebSocket, Audit Logger
  - `src/hooks`: ASR, Shortcuts, Report Status Sync
- `backend/`: FastAPI App, Worker, Queue, Modelle
- `docs/`: Architektur, Setup, Workflows, Compliance
- `scripts/`: Smoke Tests

## Wichtige Endpunkte/Ports (lokal)
- Frontend: http://localhost:5173
- Backend Health: http://localhost:8000/api/v1/health
- Orthanc UI: http://localhost:8042 (Login: orthanc/orthanc)
- DICOMweb: http://localhost:8042/dicom-web

## Entwicklungs-Setup
### Docker (empfohlen)
```
docker compose up --build
```

### GPU Stack (vLLM + MedASR)
```
docker compose -f docker-compose.yml -f docker-compose.gpu.yml --profile gpu up --build
```

### Lokale Frontend-Entwicklung
```
npm install
npm run dev
```

## Tests und Checks
- Frontend Tests: `npm run test`
- Lint: `npm run lint`
- Backend Smoke Test: `./scripts/smoke-backend.sh`
  - Optional: `API_BASE_URL=http://localhost:8000 ./scripts/smoke-backend.sh`

## Architektur-Notizen (kurz)
- UI besteht aus Left Sidebar, Viewer, Right Panel.
- Report State via `useReport`, Live-Updates via WebSocket.
- Backend orchestriert Report-Versionierung, ASR, Inferenz, QA und Audit Logging.
- Inferenz laeuft ueber RQ Worker + Redis; Ergebnisse in Postgres.

## Projektkonventionen
- TypeScript strikt.
- Keine neuen Dependencies ohne Review.
- UI muss Dark Mode kompatibel bleiben.
- Keine PHI in Logs.
- Kleine, klare Commits.

## Relevante Doku
- `docs/architecture/overview.md`
- `docs/architecture/backend.md`
- `docs/architecture/frontend.md`
- `docs/development/setup.md`
- `docs/development/testing.md`
