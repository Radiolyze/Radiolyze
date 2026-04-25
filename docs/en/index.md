# Radiolyze

Radiology workflow system with AI-assisted report generation, DICOM viewer, speech recognition, and EU AI Act-compliant audit logging.

## What is Radiolyze?

Radiolyze is an open, workflow-oriented stack for radiological report generation. It combines a full-featured DICOM viewer with multimodal AI analysis (MedGemma), medical speech input (MedASR/Whisper), structured quality checks, and comprehensive audit logging in accordance with EU AI Act requirements.

<div class="grid cards" markdown>

-   :material-monitor: **DICOM Viewer**

    Cornerstone.js-based stack viewer with tools (zoom, pan, windowing, measurements), series navigation, and prior studies comparison.

    [:octicons-arrow-right-24: Viewer Documentation](components/viewer.md)

-   :material-brain: **AI Reporting**

    MedGemma multimodal image analysis for automated findings and impressions with human oversight dialogs.

    [:octicons-arrow-right-24: MedGemma Usage](architecture/medgemma-1-5-nutzung.md)

-   :material-microphone: **Speech Input (ASR)**

    MedASR or self-hosted Whisper for medical dictation with live transcription.

    [:octicons-arrow-right-24: ASR Workflow](workflows/fast-report.md)

-   :material-shield-check: **EU AI Act Compliance**

    Complete audit logging (Art. 12), transparency (Art. 13), human oversight (Art. 14), and robustness (Art. 15).

    [:octicons-arrow-right-24: Compliance Checklist](compliance/checklist.md)

</div>

## Project Status

The current state includes:

- 3-column layout with header, sidebar, viewer, and right panel
- Findings/Impression panels including ASR and QA status (API connected, with fallbacks)
- Cornerstone Viewer (Stack, Tools, W/L Presets, Prefetch)
- DICOMweb queue for studies/series (Orthanc QIDO-RS)
- Annotation export (JSON)
- Prior studies timeline and matching suggestions in the sidebar
- Docker Compose stack (Frontend + Backend + Orthanc + Postgres)
- Orchestrator API (FastAPI) including audit logging and QA/Impression endpoints
- Inference queue (RQ + Redis) with persisted jobs and status events
- DICOM SR export (JSON + binary draft)
- Annex IV template and security baseline in the compliance documentation

Orthanc DICOMweb runs locally with Basic Auth; sample DICOM is loaded automatically.  
ASR/Impression/Inference use MedASR/MedGemma when enabled, otherwise mock fallbacks.  
QA currently uses rule-based mock checks.

## Quick Start

```bash
# Standard (CPU)
docker compose up --build

# With NVIDIA GPU
docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up --build

# With AMD ROCm
docker compose -f docker-compose.yml -f docker/compose/gpu.yml -f docker/compose/rocm.yml --profile rocm up --build

# With Whisper ASR
docker compose -f docker-compose.yml -f docker/compose/whisper.yml up --build
```

Further details: [Development Setup](development/setup.md)
