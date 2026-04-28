# GPU Setup

This guide covers GPU configuration for MedGemma AI inference and voice recognition.
GPU is optional — the system runs without one, but AI inference requires a GPU for real responses.

---

## Supported GPU Types

| Type | Minimum VRAM | Tested with |
|---|---|---|
| NVIDIA (CUDA) | 16 GB | A100 40/80 GB, RTX 4090, RTX 3090 |
| AMD (ROCm) | 16 GB | MI100, MI250, RX 7900 XTX |

!!! warning "16 GB minimum"
    MedGemma 4B requires approximately 10–12 GB of VRAM. Allow headroom for the OS and other processes. 16 GB is the practical minimum.

---

## NVIDIA GPU Setup

### Step 1: Verify the GPU and Driver

```bash
nvidia-smi
```

Expected output shows GPU model, driver version (535+), and VRAM. If the command is not found, install NVIDIA drivers first.

### Step 2: Install NVIDIA Container Toolkit

```bash
# Use the included setup script:
sudo ./scripts/setup-nvidia-docker.sh
```

Or manually:

```bash
# Add NVIDIA package repository
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Restart Docker daemon
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

### Step 3: Test Docker GPU Access

```bash
docker run --rm --gpus all nvidia/cuda:12.2-base-ubuntu22.04 nvidia-smi
```

This should display the same GPU information as `nvidia-smi` on the host. If it fails, see Troubleshooting below.

### Step 4: Configure the Hugging Face Token

MedGemma requires a Hugging Face account and access token:

1. Create an account at [huggingface.co](https://huggingface.co).
2. Accept the MedGemma model terms at [huggingface.co/google/medgemma](https://huggingface.co/google/medgemma).
3. Create an access token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) (read scope is sufficient).
4. Add it to `.env`:

```bash
HUGGINGFACE_HUB_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 5: Start with GPU Overlay

```bash
docker compose \
  -f docker-compose.yml \
  -f docker/compose/gpu.yml \
  --profile gpu \
  up --build -d
```

### Step 6: Verify GPU Inference

```bash
# Check vLLM is running
curl http://localhost:8001/v1/models

# Check GPU utilisation while inference runs
watch -n 1 nvidia-smi
```

The VRAM usage should increase to ~12 GB when MedGemma is loaded.

---

## AMD GPU Setup (ROCm)

### Step 1: Verify AMD GPU

```bash
rocm-smi
```

If not installed: `sudo apt install rocm-smi`.

### Step 2: Build the ROCm vLLM Image

```bash
DOCKER_BUILDKIT=1 docker build \
  -f docker/Dockerfile.rocm \
  -t vllm-rocm \
  .
```

This build takes 10–20 minutes.

### Step 3: Start with ROCm Overlay

```bash
docker compose \
  -f docker-compose.yml \
  -f docker/compose/gpu.yml \
  -f docker/compose/rocm.yml \
  --profile rocm \
  up --build -d
```

### Step 4: Verify

```bash
curl http://localhost:8001/v1/models
rocm-smi   # Check VRAM usage
```

---

## Whisper ASR with GPU

Voice recognition (Whisper) also benefits from GPU acceleration. Add the Whisper overlay to any GPU deployment:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker/compose/gpu.yml \
  -f docker/compose/whisper.yml \
  --profile gpu \
  up --build -d
```

Whisper requires approximately 2–4 GB of VRAM depending on the model size configured.

---

## Monitoring GPU Usage

```bash
# Real-time GPU utilisation
nvidia-smi dmon -s u    # NVIDIA
rocm-smi                # AMD

# Prometheus metrics from vLLM
curl http://localhost:8001/metrics | grep -E "vllm_gpu|cache_usage"

# Check inference latency via drift endpoint
curl http://localhost:8000/api/v1/monitoring/drift
```

---

## Troubleshooting

### `docker: Error response from daemon: could not select device driver "nvidia"`

The NVIDIA Container Toolkit is not properly configured.

```bash
# Check runtime is registered:
docker info | grep -i nvidia

# If missing, re-run:
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Then test again:
docker run --rm --gpus all nvidia/cuda:12.2-base-ubuntu22.04 nvidia-smi
```

### `cuda error: out of memory`

The GPU does not have enough free VRAM.

```bash
# Check what is using VRAM:
nvidia-smi

# Kill other processes using the GPU, then restart:
docker compose restart vllm
```

Consider reducing the model size or increasing server VRAM.

### `vLLM service not starting`

```bash
# Check vLLM logs:
docker compose logs vllm --tail=100

# Common causes:
# - HUGGINGFACE_HUB_TOKEN missing or invalid
# - Model not yet approved on Hugging Face (accept terms)
# - Insufficient disk space to download model weights (~8 GB)
```

Check disk space:

```bash
df -h /var/lib/docker
```

### Model download is slow or failing

Model weights (~8 GB) are downloaded from Hugging Face on first start. In environments with limited or no internet access:

1. Pre-download the model on a machine with internet access.
2. Transfer the model files to the server.
3. Mount the local model directory in `docker/compose/gpu.yml`:

```yaml
services:
  vllm:
    volumes:
      - /path/to/medgemma:/root/.cache/huggingface
```

### `Ctrl+Enter` works but no AI output

The vLLM service may be running but the model not yet loaded (startup can take 2–5 minutes).

```bash
# Check if model is loaded:
curl http://localhost:8001/v1/models

# Watch the vLLM log for "Model loaded":
docker compose logs -f vllm | grep -i "loaded\|ready\|error"
```

---

## Performance Tuning

| Parameter | Location | Effect |
|---|---|---|
| `VITE_INFERENCE_MAX_FRAMES_CURRENT` | `.env` | Number of frames sent per current study (default: 16) |
| `VITE_INFERENCE_MAX_FRAMES_PRIOR` | `.env` | Frames for prior studies (default: 8) |
| `--max-model-len` | `gpu.yml` vLLM args | Context length; reduce to save VRAM |
| `--tensor-parallel-size` | `gpu.yml` vLLM args | Number of GPUs for multi-GPU setups |

For multi-GPU inference, set `--tensor-parallel-size` to the number of GPUs and ensure all are listed in `--gpus` in `gpu.yml`.
