# MedGemma Insight

Radiologie-Workflow-System mit KI-gestützter Befunderstellung, DICOM Viewer, Spracherkennung und EU-AI-Act konformem Audit-Logging.

## Features

- **DICOM Viewer**: Cornerstone.js-basierter Stack-Viewer mit Tools (Zoom, Pan, Fensterung, Messungen), Seriennavigation und Prior-Studies-Vergleich
- **KI-Befundung**: MedGemma multimodale Bildanalyse für automatisierte Findings und Impressions
- **Spracheingabe (ASR)**: MedASR für medizinisches Diktat mit Live-Transkription
- **QA-Checks**: Automatische Qualitätsprüfungen und strukturierte Validierung
- **Templates & Guidelines**: Institutions-Templates und Leitlinienhinweise im Workflow
- **Audit-Logging**: Vollständige Nachvollziehbarkeit aller Aktionen (EU-AI-Act konform)
- **DICOM SR Export**: Strukturierte Berichte als JSON oder DICOM SR
- **Batch-Verarbeitung**: Queue-basiertes Reporting für mehrere Studien

## Architektur

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
              │ MedASR              │
              └─────────────────────┘
```

## Tech Stack

**Frontend**
- React 18 + TypeScript
- Vite (Build & Dev Server)
- shadcn/ui + Tailwind CSS
- Cornerstone.js (DICOM Rendering)
- i18next (Internationalisierung)

**Backend**
- FastAPI (REST API + WebSocket)
- PostgreSQL (Reports, Audit Events)
- Redis + RQ (Job Queue)
- pydicom (DICOM SR)

**DICOM / PACS**
- Orthanc (Mini-PACS, DICOMweb Provider)

**KI-Services (optional)**
- vLLM mit MedGemma (multimodale Analyse)
- MedASR (Spracherkennung)

## Quick Start

### Docker (empfohlen)

```bash
docker compose up --build
```

### Mit GPU (NVIDIA CUDA)

```bash
# .env Datei erstellen (siehe env.example)
# HUGGINGFACE_HUB_TOKEN setzen

docker compose -f docker-compose.yml -f docker-compose.gpu.yml --profile gpu up --build
```

### Mit GPU (AMD ROCm)

```bash
DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile.rocm -t vllm-rocm .
docker compose -f docker-compose.yml -f docker-compose.gpu.yml -f docker-compose.rocm.yml --profile rocm up --build
```

## Lokale Entwicklung

**Voraussetzungen**: Node.js 18+, npm

```bash
# Dependencies installieren
npm install

# Development Server starten
npm run dev
```

Backend separat starten (benötigt Python 3.11+, Redis, PostgreSQL):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## URLs (lokale Entwicklung)

| Service      | URL                                    |
| ------------ | -------------------------------------- |
| Frontend     | http://localhost:5173                  |
| Backend API  | http://localhost:8000/api/v1/health    |
| Orthanc UI   | http://localhost:8042                  |
| DICOMweb     | http://localhost:8042/dicom-web        |

**Orthanc Login** (lokale Entwicklung): `orthanc` / `orthanc`

Beim ersten Start werden automatisch DICOM-Beispieldaten geladen.
Anpassbar über `ORTHANC_SEED_URLS` (kommasepariert).

## Konfiguration

Umgebungsvariablen in `.env` (Vorlage: `env.example`):

```bash
# Hugging Face Token für MedGemma
HUGGINGFACE_HUB_TOKEN=hf_xxx

# Proxy-Targets für lokale Entwicklung ohne Docker
VITE_API_PROXY_TARGET=http://localhost:8000
VITE_DICOM_WEB_PROXY_TARGET=http://localhost:8042

# DICOMweb Authentifizierung
VITE_DICOM_WEB_USERNAME=orthanc
VITE_DICOM_WEB_PASSWORD=orthanc

# Inference Frame Sampling
VITE_INFERENCE_MAX_FRAMES_CURRENT=16
VITE_INFERENCE_MAX_FRAMES_PRIOR=8
```

## Tests

```bash
# Frontend Tests
npm run test

# Lint
npm run lint

# Backend Smoke Test
./scripts/smoke-backend.sh
```

## Seiten / Routen

| Route      | Beschreibung                                |
| ---------- | ------------------------------------------- |
| `/`        | Haupt-Workspace (Viewer + Befundung)        |
| `/batch`   | Batch-Dashboard mit Bulk-Aktionen           |
| `/history` | Audit-Log und Report-Historie               |
| `/settings`| Benutzereinstellungen                       |

## Compliance (EU-AI-Act)

Das System implementiert Anforderungen des EU AI Acts für Hochrisiko-KI:

- **Art. 12**: Vollständiges Audit-Logging aller KI-Interaktionen
- **Art. 13**: Transparenz durch Status-Anzeigen und Erklärungen
- **Art. 14**: Human Oversight durch Approval-Dialoge und Editierbarkeit
- **Art. 15**: Robustheit durch Fallback-UI bei Inferenz-Fehlern

Details: `docs/compliance/`

## Dokumentation

- [Architektur Übersicht](docs/architecture/overview.md)
- [Backend Architektur](docs/architecture/backend.md)
- [Frontend Architektur](docs/architecture/frontend.md)
- [API Endpoints](docs/api/endpoints.md)
- [WebSocket Events](docs/api/websocket.md)
- [Development Setup](docs/development/setup.md)
- [Workflows](docs/workflows/overview.md)

## Lizenz

Proprietär - Alle Rechte vorbehalten.
