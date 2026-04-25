# API Overview

The UI uses HTTP and WebSocket APIs:

- REST: report management, QA, audit
- WebSocket: live updates (ASR/AI status, UI refresh)

## Current State (Repo)

- FastAPI orchestrator at `/api/v1`
- Core domains: reports (including revisions, PDF/SR export, critical findings, peer review), ASR, impression (including streaming), inference queue, QA rules, prompts, templates, guidelines, annotations, training export, monitoring metrics, audit
- WebSocket: `/api/v1/ws` (optional JWT)
- CORS configurable via `CORS_ORIGINS`
- vLLM/MedASR optional; health check verifies reachable services
- Multimodal: `image_urls` / `image_paths` in impression and inference
- Full route list: [API Endpoints](endpoints.md); machine-readable: OpenAPI at `/docs` on the running backend

## Versioning

All endpoints should be served under `/api/v1`.

## Auth

- API: JWT login at `/api/v1/auth/login`; `AUTH_REQUIRED` controls whether protected routes require a valid Bearer token (default: enabled)
- WebSocket: when `AUTH_REQUIRED=true`, JWT is required as query parameter `token`
- Orthanc DICOMweb: basic auth (locally typically `orthanc/orthanc`)
- Production: use strong passwords, set `ADMIN_PASSWORD`, optionally use mTLS for intra-cluster communication
