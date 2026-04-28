# Schnellstart — In 5 Minuten startklar

Dieser Leitfaden startet Radiolyze lokal mit Demo-DICOM-Daten über Docker.
Kein GPU, keine Konfiguration, keine Patientendaten erforderlich.

---

## Voraussetzungen

Sie benötigen Docker mit Compose v2:

- **Docker Desktop** (Mac / Windows / Linux) — enthält Compose
- **Docker Engine + Docker Compose Plugin** unter Linux

Prüfen:

```bash
docker --version          # sollte 24.x oder neuer sein
docker compose version    # sollte v2.x sein
```

---

## Schritt 1: Code herunterladen

```bash
git clone https://github.com/radiolyze/radiolyze.git
cd radiolyze
```

---

## Schritt 2: Stack starten

```bash
docker compose up --build
```

Dies startet fünf Dienste: **Frontend** (React), **Backend** (FastAPI), **Orthanc** (Mini-PACS), **PostgreSQL** und **Redis**.

Beim ersten Start werden automatisch Beispiel-DICOM-Studien heruntergeladen und geladen. Beim ersten Build mit 2–5 Minuten rechnen.

---

## Schritt 3: Browser öffnen

| Dienst | URL |
|---|---|
| Radiolyze UI | [http://localhost:5173](http://localhost:5173) |
| Backend API-Dokumentation | [http://localhost:8000/docs](http://localhost:8000/docs) |
| Orthanc PACS UI | [http://localhost:8042](http://localhost:8042) |

Orthanc-Login für lokale Entwicklung: `orthanc` / `orthanc`

---

## Schritt 4: Demo-Studien erkunden

Die linke Sidebar zeigt eine Arbeitsliste der geladenen Studien. Klicken Sie auf eine Studie, um sie im Viewer zu öffnen.

**Ausprobieren:**

1. **Röntgen-Thorax öffnen** aus der Arbeitsliste — der DICOM-Viewer lädt im mittleren Panel.
2. **Fensterungs-Presets** verwenden — auf Presets in der Viewer-Toolbar klicken.
3. **Findings-Panel** rechts — Findings tippen oder diktieren (ASR benötigt MedASR/Whisper-Overlay, s.u.).
4. **KI-Impression anfordern** — „Impression generieren" klicken (benötigt GPU-Overlay, sonst Mock-Antwort).
5. **QA-Status prüfen** — das QA-Panel zeigt automatische Qualitätsprüfungen.
6. **Bericht freigeben** — „Freigeben" im Impression-Panel klicken, um den Workflow abzuschließen.

---

## Optional: GPU + KI aktivieren (NVIDIA)

Für echte KI-Inferenz mit MedGemma wird eine NVIDIA GPU mit ≥16 GB VRAM und das NVIDIA Container Toolkit benötigt.

```bash
# NVIDIA Container Toolkit einmalig installieren:
sudo ./scripts/setup-nvidia-docker.sh

# Env-Template kopieren und Hugging-Face-Token eintragen:
cp env.example .env
# .env bearbeiten und HUGGINGFACE_HUB_TOKEN=hf_xxx setzen

# Mit GPU-Overlay starten:
docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up --build
```

---

## Optional: Spracherkennung aktivieren (Whisper)

Für lokale Spracherkennung ohne MedASR:

```bash
docker compose -f docker-compose.yml -f docker/compose/whisper.yml up --build
```

---

## Optional: AMD GPU (ROCm)

```bash
DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile.rocm -t vllm-rocm .
docker compose -f docker-compose.yml -f docker/compose/gpu.yml -f docker/compose/rocm.yml --profile rocm up --build
```

---

## Häufige Probleme beim ersten Start

??? question "Port wird bereits verwendet"
    Prüfen, ob ein anderer Dienst die Ports 5173, 8000 oder 8042 belegt:
    ```bash
    sudo lsof -i :5173
    sudo lsof -i :8000
    sudo lsof -i :8042
    ```
    Konfliktierenden Dienst stoppen oder Ports in `docker-compose.yml` ändern.

??? question "Keine Studien in der Arbeitsliste"
    Der Seed-Loader läuft beim ersten Start und braucht ggf. eine Minute. Status prüfen:
    ```bash
    docker compose logs backend | grep seed
    ```
    Falls fehlgeschlagen: `docker compose restart backend`

??? question "Build schlägt fehl: 'no space left on device'"
    Docker benötigt Speicherplatz für Images. Aufräumen:
    ```bash
    docker system prune -f
    ```

??? question "GPU wird nicht erkannt"
    NVIDIA Container Toolkit prüfen:
    ```bash
    nvidia-smi
    docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi
    ```

---

## Nächste Schritte

- **Radiologe:** [Arzt-Leitfaden](../doctors/index.md) für den vollständigen Befundungs-Workflow lesen.
- **Administrator:** Dem [Administrations-Leitfaden](../admin/index.md) für ein Produktions-Setup folgen.
- **Entwickler:** [Entwicklungs-Setup](../development/setup.md) für den Betrieb ohne Docker.
- **Forscher:** [MedGemma und die KI-Pipeline](../research/index.md) erkunden.
