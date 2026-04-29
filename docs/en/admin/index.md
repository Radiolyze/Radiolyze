# Administration Guide

This section covers deployment, configuration, security, monitoring, and maintenance of Radiolyze
in a hospital or private cloud environment.

---

## System Requirements

### Minimum (Evaluation / CPU-only)

| Component | Requirement |
|---|---|
| CPU | 4 cores x86-64 |
| RAM | 8 GB |
| Storage | 20 GB for stack + additional space for DICOM archive |
| OS | Linux (any modern distribution) |
| Docker | Engine 24.x + Compose v2 plugin |
| Network | Ports 5173 (UI), 8000 (API), 8042 (Orthanc) accessible from clients |

### Recommended (Clinical / GPU AI)

| Component | Requirement |
|---|---|
| CPU | 8+ cores |
| RAM | 32 GB |
| GPU | NVIDIA with ≥16 GB VRAM (e.g., A100, RTX 4090) |
| Storage | 100+ GB (SSD preferred for DICOM) |
| OS | Ubuntu 22.04 LTS |
| Docker | Engine 24.x + Compose v2 + NVIDIA Container Toolkit |

---

## Deployment Modes

| Mode | Command | Use Case |
|---|---|---|
| CPU only | `docker compose up --build` | Evaluation, development |
| NVIDIA GPU | `docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up --build` | AI inference (MedGemma) |
| AMD ROCm | `docker compose -f docker-compose.yml -f docker/compose/gpu.yml -f docker/compose/rocm.yml --profile rocm up --build` | AMD GPU inference |
| Whisper ASR | `docker compose -f docker-compose.yml -f docker/compose/whisper.yml up --build` | Local voice dictation |

---

## Key Configuration (Environment Variables)

Copy `env.example` to `.env` and adjust:

```bash
# AI model access (required for MedGemma)
HUGGINGFACE_HUB_TOKEN=hf_xxx

# Orthanc credentials (CHANGE IN PRODUCTION)
VITE_DICOM_WEB_USERNAME=orthanc
VITE_DICOM_WEB_PASSWORD=orthanc

# API proxy targets (local dev without Docker)
VITE_API_PROXY_TARGET=http://localhost:8000
VITE_DICOM_WEB_PROXY_TARGET=http://localhost:8042

# AI inference frame limits
VITE_INFERENCE_MAX_FRAMES_CURRENT=16
VITE_INFERENCE_MAX_FRAMES_PRIOR=8
```

---

## Security

!!! danger "Change these before any clinical use"
    - Default Orthanc credentials: `orthanc/orthanc` — **must be changed**
    - No TLS by default — add HTTPS via reverse proxy
    - No authentication/RBAC — users have full access to all studies

### Production Security Checklist

- [ ] TLS terminated at NGINX or ingress reverse proxy (HTTPS)
- [ ] HSTS enabled for the UI domain
- [ ] Orthanc credentials changed and rotated
- [ ] JWT secrets rotated (not defaults)
- [ ] PostgreSQL password changed (not defaults)
- [ ] Internal services (DB, Redis, Orthanc) not exposed on public interfaces
- [ ] Firewall rules: only ports 80/443 (or 5173/8000 in dev) open to clients
- [ ] Rate limiting configured in NGINX
- [ ] PHI not logged in application logs
- [ ] DICOM anonymisation configured if studies leave the hospital network

Full security baseline: [Security Documentation](../operations/security.md)

---

## Quick Production Checklist (minimum)

- [ ] **TLS / HTTPS** in front of UI + API (reverse proxy / ingress)
- [ ] **Change all default credentials** (Orthanc, PostgreSQL, JWT secrets)
- [ ] **Restrict network exposure** (DB/Redis/Orthanc internal only)
- [ ] **Backups configured and restore tested** (Postgres + Orthanc volumes)
- [ ] **Audit log retention defined** (per local policy)
- [ ] **Monitoring + alerting** for API errors, inference failures, disk usage

For a guided baseline, start with:
- [Deployment Guide](deployment.md)
- [Security Hardening](security-hardening.md)
- [Backup & Recovery](backup-recovery.md)

---

## Service Health Checks

| Service | Check |
|---|---|
| Frontend | `curl http://localhost:5173` |
| Backend API | `curl http://localhost:8000/api/v1/health` |
| Orthanc | `curl -u orthanc:orthanc http://localhost:8042/api/system` |
| GPU / vLLM | `curl http://localhost:8001/v1/models` |
| Whisper | `curl http://localhost:9000/asr` |

Check all services at once:

```bash
docker compose ps
docker compose logs --tail 50
```

---

## DICOM Integration

### Loading Studies

Send DICOM data to Orthanc via:

- **DICOM C-STORE** — configure your modality or PACS to send to `<host>:4242` (DICOM port)
- **DICOMweb STOW-RS** — `POST http://<host>:8042/dicom-web/studies`
- **Orthanc Web UI** — drag and drop at `http://<host>:8042` (use Orthanc credentials)
- **Automatic seed** — set `ORTHANC_SEED_URLS` in `.env` to load public DICOM datasets on startup

### Orthanc Configuration

The Orthanc configuration is embedded in `docker-compose.yml`. For production, mount a custom `orthanc.json`:

```yaml
volumes:
  - ./config/orthanc.json:/etc/orthanc/orthanc.json
```

See the [Orthanc documentation](https://orthanc-server.com/static.php?page=documentation) for modality routing, DICOMweb settings, and authentication.

---

## Monitoring

Key metrics are exposed at:

- **Prometheus metrics** (vLLM): `http://localhost:8001/metrics`
- **Drift monitoring**: `GET /api/v1/monitoring/drift` (requires backend running)
- **Audit events**: `GET /api/v1/audit` (admin access only)

Full observability setup: [Observability Guide](../operations/observability.md)

---

## Backup

Three components require regular backups:

| Component | Data | Backup Command |
|---|---|---|
| PostgreSQL | Reports, audit events | `pg_dump -U postgres radiolyze > backup.sql` |
| Orthanc | DICOM studies | Backup Docker volume `orthanc-data` |
| `.env` / configs | Environment variables | Store securely outside the repository |

Test restores at least monthly. Document retention periods per local regulatory requirements.

---

## Starting and Stopping

```bash
# Start in background
docker compose up -d

# Stop (preserves data volumes)
docker compose down

# Stop and remove volumes (DELETES ALL DATA)
docker compose down -v

# Restart a single service
docker compose restart backend
```

---

## Operations Runbook

For day-to-day operations, incidents, and common troubleshooting scenarios:
[Operations Runbook](../operations/runbook.md)

---

*Detailed guides for GPU setup, backup/recovery, monitoring alerting, and incident response are planned for Phase 2 of the documentation.*
