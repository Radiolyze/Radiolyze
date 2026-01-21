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

- Frontend: http://localhost:5173
- Backend: http://localhost:8000/api/v1/health
- Orthanc UI: http://localhost:8042
- DICOMweb: http://localhost:8042/dicom-web

Orthanc Login (lokal):

- User: `orthanc`
- Password: `orthanc`

Beim ersten Start wird automatisch ein kleines DICOM Sample geladen.

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
