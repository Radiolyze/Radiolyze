# GPU-Setup

GPU-Konfiguration für MedGemma KI-Inferenz und Spracherkennung. GPU ist optional — das System läuft ohne, aber für echte KI-Inferenz ist eine GPU erforderlich.

---

## Unterstützte GPU-Typen

| Typ | Mindest-VRAM | Getestet mit |
|---|---|---|
| NVIDIA (CUDA) | 16 GB | A100 40/80 GB, RTX 4090, RTX 3090 |
| AMD (ROCm) | 16 GB | MI100, MI250, RX 7900 XTX |

---

## NVIDIA GPU Setup

### Schritt 1: GPU und Treiber verifizieren

```bash
nvidia-smi
```

Ausgabe zeigt GPU-Modell, Treiberversion (535+) und VRAM. Falls Befehl nicht gefunden: NVIDIA-Treiber zuerst installieren.

### Schritt 2: NVIDIA Container Toolkit installieren

```bash
# Mit dem beigefügten Setup-Skript:
sudo ./scripts/setup-nvidia-docker.sh
```

Oder manuell:

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

### Schritt 3: Docker GPU-Zugriff testen

```bash
docker run --rm --gpus all nvidia/cuda:12.2-base-ubuntu22.04 nvidia-smi
```

### Schritt 4: Hugging Face Token konfigurieren

1. Konto erstellen auf [huggingface.co](https://huggingface.co)
2. MedGemma-Modell-Bedingungen akzeptieren
3. Access Token erstellen (Lese-Berechtigung ausreichend)
4. In `.env` eintragen:

```bash
HUGGINGFACE_HUB_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Schritt 5: Mit GPU-Overlay starten

```bash
docker compose \
  -f docker-compose.yml \
  -f docker/compose/gpu.yml \
  --profile gpu \
  up --build -d
```

### Schritt 6: GPU-Inferenz verifizieren

```bash
curl http://localhost:8001/v1/models
watch -n 1 nvidia-smi
```

VRAM-Nutzung sollte auf ~12 GB steigen wenn MedGemma geladen ist.

---

## AMD GPU Setup (ROCm)

### Schritt 1: AMD GPU verifizieren

```bash
rocm-smi
```

### Schritt 2: ROCm vLLM Image bauen

```bash
DOCKER_BUILDKIT=1 docker build \
  -f docker/Dockerfile.rocm \
  -t vllm-rocm \
  .
```

Bau dauert 10–20 Minuten.

### Schritt 3: Mit ROCm-Overlay starten

```bash
docker compose \
  -f docker-compose.yml \
  -f docker/compose/gpu.yml \
  -f docker/compose/rocm.yml \
  --profile rocm \
  up --build -d
```

---

## Whisper ASR mit GPU

```bash
docker compose \
  -f docker-compose.yml \
  -f docker/compose/gpu.yml \
  -f docker/compose/whisper.yml \
  --profile gpu \
  up --build -d
```

Whisper benötigt ca. 2–4 GB VRAM.

---

## GPU-Nutzung überwachen

```bash
nvidia-smi dmon -s u
curl http://localhost:8001/metrics | grep -E "vllm_gpu|cache_usage"
curl http://localhost:8000/api/v1/monitoring/drift
```

---

## Fehlerbehebung

### `could not select device driver "nvidia"`

```bash
docker info | grep -i nvidia
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
docker run --rm --gpus all nvidia/cuda:12.2-base-ubuntu22.04 nvidia-smi
```

### `cuda error: out of memory`

```bash
nvidia-smi   # VRAM-Nutzung prüfen
docker compose restart vllm
```

### vLLM-Dienst startet nicht

```bash
docker compose logs vllm --tail=100
# Häufige Ursachen:
# - HUGGINGFACE_HUB_TOKEN fehlt oder ungültig
# - Modell auf Hugging Face nicht genehmigt (Bedingungen akzeptieren)
# - Unzureichend Festplattenspeicher (~8 GB für Modell-Gewichte)
df -h /var/lib/docker
```

### Modell-Download langsam oder fehlschlagend

In Umgebungen ohne Internetzugang: Modell vorab herunterladen und lokales Verzeichnis mounten:

```yaml
services:
  vllm:
    volumes:
      - /pfad/zu/medgemma:/root/.cache/huggingface
```

---

## Performance-Tuning

| Parameter | Speicherort | Effekt |
|---|---|---|
| `VITE_INFERENCE_MAX_FRAMES_CURRENT` | `.env` | Frames pro aktueller Studie (Standard: 16) |
| `VITE_INFERENCE_MAX_FRAMES_PRIOR` | `.env` | Frames für Voruntersuchungen (Standard: 8) |
| `--max-model-len` | `gpu.yml` vLLM-Args | Kontextlänge; reduzieren um VRAM zu sparen |
| `--tensor-parallel-size` | `gpu.yml` vLLM-Args | Anzahl GPUs für Multi-GPU-Setup |
