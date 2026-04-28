# Deployment Guide

This guide covers a complete Radiolyze installation — from server preparation to a running, verified system.
Read [System Requirements](index.md#system-requirements) first to ensure your hardware qualifies.

---

## Prerequisites

### Software

| Component | Minimum version | Installation |
|---|---|---|
| Docker Engine | 24.x | [docs.docker.com/engine/install](https://docs.docker.com/engine/install/) |
| Docker Compose plugin | v2.x | Included with Docker Desktop; for Linux: `sudo apt install docker-compose-plugin` |
| Git | Any recent | `sudo apt install git` |

Verify:

```bash
docker --version
docker compose version
git --version
```

### For GPU inference (NVIDIA)

| Component | Requirement |
|---|---|
| NVIDIA GPU | ≥16 GB VRAM (A100, RTX 4090, etc.) |
| NVIDIA Driver | 535+ (check: `nvidia-smi`) |
| NVIDIA Container Toolkit | See [GPU Setup Guide](gpu-setup.md) |

### Ports

Ensure these ports are available and, if needed, opened in your firewall:

| Port | Service | Open to |
|---|---|---|
| 5173 | Frontend UI (dev) or 80/443 (prod) | Client workstations |
| 8000 | Backend API | Frontend only (internal) |
| 8042 | Orthanc DICOMweb / UI | Modalities, admin workstations |
| 4242 | DICOM C-STORE (Orthanc) | Modalities |
| 5432 | PostgreSQL | Internal only |
| 6379 | Redis | Internal only |

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/radiolyze/radiolyze.git
cd radiolyze
```

---

## Step 2: Configure Environment

```bash
cp env.example .env
```

Edit `.env` with your settings:

```bash
# Required for MedGemma (obtain at huggingface.co)
HUGGINGFACE_HUB_TOKEN=hf_xxxxxxxxxxxxxxxx

# Change these in production!
VITE_DICOM_WEB_USERNAME=your_orthanc_user
VITE_DICOM_WEB_PASSWORD=your_strong_password

# Leave these for Docker deployments:
VITE_API_PROXY_TARGET=http://backend:8000
VITE_DICOM_WEB_PROXY_TARGET=http://orthanc:8042
```

---

## Step 3: Choose Your Deployment Mode

=== "CPU Only (evaluation)"
    No GPU, no AI inference — suitable for evaluating the UI and DICOM workflow.

    ```bash
    docker compose up --build -d
    ```

=== "NVIDIA GPU"
    Full AI inference with MedGemma. Requires NVIDIA Container Toolkit.

    ```bash
    # Install NVIDIA Container Toolkit first (once):
    sudo ./scripts/setup-nvidia-docker.sh

    docker compose \
      -f docker-compose.yml \
      -f docker/compose/gpu.yml \
      --profile gpu \
      up --build -d
    ```

=== "AMD ROCm"
    For AMD GPU inference.

    ```bash
    DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile.rocm -t vllm-rocm .

    docker compose \
      -f docker-compose.yml \
      -f docker/compose/gpu.yml \
      -f docker/compose/rocm.yml \
      --profile rocm \
      up --build -d
    ```

=== "With Whisper ASR"
    Add self-hosted speech recognition to any of the above:

    ```bash
    docker compose \
      -f docker-compose.yml \
      -f docker/compose/whisper.yml \
      up --build -d
    ```

    Combine with GPU:
    ```bash
    docker compose \
      -f docker-compose.yml \
      -f docker/compose/gpu.yml \
      -f docker/compose/whisper.yml \
      --profile gpu \
      up --build -d
    ```

---

## Step 4: Verify Services

Wait 60–120 seconds for all services to start, then check:

```bash
# All services should be "running" or "healthy"
docker compose ps

# Individual health checks:
curl http://localhost:8000/api/v1/health
curl -u orthanc:orthanc http://localhost:8042/api/system
```

Expected response from backend health:

```json
{"status": "ok", "version": "..."}
```

---

## Step 5: Verify DICOM Data

On first start, sample DICOM studies load automatically (controlled by `ORTHANC_SEED_URLS` in `.env`).

Check that studies are available:

```bash
# Count studies in Orthanc
curl -s -u orthanc:orthanc http://localhost:8042/studies | python3 -c "import sys,json; print(len(json.load(sys.stdin)), 'studies')"
```

Open the Orthanc web UI at `http://localhost:8042` to browse studies visually.

---

## Step 6: Open the Application

Navigate to `http://localhost:5173` (or your server's hostname if not on localhost).

The worklist should display the loaded studies. Click any study to open the viewer.

---

## Production Setup Checklist

Before clinical use, complete all of these:

- [ ] **TLS / HTTPS** — terminate TLS at NGINX or another reverse proxy (see below)
- [ ] **Orthanc credentials changed** — replace default `orthanc/orthanc`
- [ ] **PostgreSQL credentials changed** — set strong DB passwords in `.env`
- [ ] **JWT secrets set** — generate random secrets for token signing
- [ ] **Firewall rules applied** — only expose ports 80/443 to clients; keep 5432, 6379, 8000 internal
- [ ] **Backup configured** — see [Backup and Recovery](backup-recovery.md)
- [ ] **Monitoring set up** — see [Observability Guide](../operations/observability.md)
- [ ] **Security hardening complete** — see [Security Hardening](security-hardening.md)

---

## Adding HTTPS (NGINX Reverse Proxy)

For production, place NGINX in front of the stack:

```nginx
# /etc/nginx/sites-available/radiolyze
server {
    listen 80;
    server_name radiolyze.yourhospital.example;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name radiolyze.yourhospital.example;

    ssl_certificate     /etc/ssl/certs/radiolyze.crt;
    ssl_certificate_key /etc/ssl/private/radiolyze.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Use [Certbot](https://certbot.eff.org/) for free Let's Encrypt certificates (not appropriate for air-gapped hospital networks — use your institution's PKI instead).

---

## Updating Radiolyze

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose up --build -d

# Verify health
docker compose ps
curl http://localhost:8000/api/v1/health
```

For GPU deployments, include the same overlay files used during initial deployment.

Database migrations run automatically on backend startup.

---

## Uninstalling

```bash
# Stop and remove containers (keeps data volumes)
docker compose down

# Remove containers AND all data (IRREVERSIBLE)
docker compose down -v
docker rmi $(docker images | grep radiolyze | awk '{print $3}')
```

---

## Troubleshooting First-Run Issues

**Services not starting:**
```bash
docker compose logs --tail=50 <service-name>
# e.g.: docker compose logs --tail=50 backend
```

**Port conflicts:**
```bash
sudo lsof -i :5173   # or 8000, 8042
```

**No studies in worklist after startup:**
```bash
docker compose logs backend | grep -i seed
# Restart backend if seed failed:
docker compose restart backend
```

**GPU not detected:**
See [GPU Setup Guide](gpu-setup.md#troubleshooting).
