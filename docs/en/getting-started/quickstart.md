# Quickstart — Up and Running in 5 Minutes

This guide gets Radiolyze running locally with demo DICOM data using Docker.
No GPU, no configuration, no patient data required.

---

## Prerequisites

You need Docker with Compose v2 support:

- **Docker Desktop** (Mac / Windows / Linux) — includes Compose
- **Docker Engine + Docker Compose plugin** on Linux

Verify:

```bash
docker --version          # should be 24.x or newer
docker compose version    # should be v2.x
```

---

## Step 1: Get the Code

```bash
git clone https://github.com/radiolyze/radiolyze.git
cd radiolyze
```

---

## Step 2: Start the Stack

```bash
docker compose up --build
```

This starts five services: **Frontend** (React), **Backend** (FastAPI), **Orthanc** (mini-PACS), **PostgreSQL**, and **Redis**.

On first start it also downloads and loads sample DICOM studies automatically. Expect 2–5 minutes for the initial build.

---

## Step 3: Open the Browser

| Service | URL |
|---|---|
| Radiolyze UI | [http://localhost:5173](http://localhost:5173) |
| Backend API docs | [http://localhost:8000/docs](http://localhost:8000/docs) |
| Orthanc PACS UI | [http://localhost:8042](http://localhost:8042) |

Orthanc login for local development: `orthanc` / `orthanc`

---

## Step 4: Explore the Demo Studies

The sidebar on the left shows a worklist of loaded studies. Click any study to open it in the viewer.

**Things to try:**

1. **Open a chest X-ray** from the worklist — the DICOM viewer loads in the centre panel.
2. **Use windowing presets** — click the window/level presets in the viewer toolbar.
3. **Try the Findings panel** on the right — type or dictate findings (ASR requires MedASR/Whisper overlay, see below).
4. **Request AI impression** — click "Generate Impression" to see an AI draft (requires GPU overlay, otherwise a mock response is returned).
5. **Check QA status** — the QA panel shows automated quality checks on your report.
6. **Approve the report** — click "Approve" in the impression panel to complete the workflow.

---

## Optional: Enable GPU + AI (NVIDIA) {#optional-enable-gpu--ai-nvidia}

To use MedGemma for real AI inference you need an NVIDIA GPU with ≥16 GB VRAM and the NVIDIA Container Toolkit installed.

```bash
# Install NVIDIA Container Toolkit (once):
sudo ./scripts/setup-nvidia-docker.sh

# Copy env template and add your Hugging Face token:
cp env.example .env
# Edit .env and set HUGGINGFACE_HUB_TOKEN=hf_xxx

# Start with GPU overlay:
docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up --build
```

---

## Optional: Enable Voice Dictation (Whisper)

To use local speech recognition without MedASR:

```bash
docker compose -f docker-compose.yml -f docker/compose/whisper.yml up --build
```

---

## Optional: Enable AMD GPU (ROCm)

```bash
DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile.rocm -t vllm-rocm .
docker compose -f docker-compose.yml -f docker/compose/gpu.yml -f docker/compose/rocm.yml --profile rocm up --build
```

---

## Common First-Run Issues

??? question "Port already in use"
    Check if another service is using ports 5173, 8000, or 8042:
    ```bash
    sudo lsof -i :5173
    sudo lsof -i :8000
    sudo lsof -i :8042
    ```
    Stop conflicting services or change ports in `docker-compose.yml`.

??? question "No studies appear in the worklist"
    The seed loader runs on first start and may take a minute. Check its status:
    ```bash
    docker compose logs backend | grep seed
    ```
    If it failed, re-run: `docker compose restart backend`

??? question "Build fails with 'no space left on device'"
    Docker needs disk space for images. Clean up with:
    ```bash
    docker system prune -f
    ```

??? question "GPU not detected"
    Verify the NVIDIA Container Toolkit is installed and the daemon was restarted:
    ```bash
    nvidia-smi
    docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi
    ```

---

## Next Steps

- **Radiologist:** Read the [Doctor's Guide](../doctors/index.md) for the full reporting workflow.
- **Administrator:** Follow the [Deployment Guide](../admin/index.md) for a production setup.
- **Developer:** See [Development Setup](../development/setup.md) for running without Docker.
- **Researcher:** Explore [MedGemma and the AI pipeline](../research/index.md).
