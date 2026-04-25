# Radiolyze

Radiologie-Workflow-System mit KI-gestützter Befunderstellung, DICOM Viewer, Spracherkennung und EU-AI-Act-konformem Audit-Logging.

## Was ist Radiolyze?

Radiolyze ist ein offener, workflow-orientierter Stack für radiologische Befunderstellung. Er kombiniert einen vollständigen DICOM-Viewer mit multimodaler KI-Analyse (MedGemma), medizinischer Spracheingabe (MedASR/Whisper), strukturierten Qualitätsprüfungen und lückenlosem Audit-Logging nach EU AI Act Anforderungen.

<div class="grid cards" markdown>

-   :material-monitor: **DICOM Viewer**

    Cornerstone.js-basierter Stack-Viewer mit Tools (Zoom, Pan, Fensterung, Messungen), Seriennavigation und Prior-Studies-Vergleich.

    [:octicons-arrow-right-24: Viewer Dokumentation](components/viewer.md)

-   :material-brain: **KI-Befundung**

    MedGemma multimodale Bildanalyse für automatisierte Findings und Impressions mit Human-Oversight-Dialogen.

    [:octicons-arrow-right-24: MedGemma Nutzung](architecture/medgemma-1-5-nutzung.md)

-   :material-microphone: **Spracheingabe (ASR)**

    MedASR oder selbst-gehostetes Whisper für medizinisches Diktat mit Live-Transkription.

    [:octicons-arrow-right-24: ASR Workflow](workflows/fast-report.md)

-   :material-shield-check: **EU AI Act Compliance**

    Vollständiges Audit-Logging (Art. 12), Transparenz (Art. 13), Human Oversight (Art. 14) und Robustheit (Art. 15).

    [:octicons-arrow-right-24: Compliance Checkliste](compliance/checklist.md)

</div>

## Projektstatus

Der aktuelle Stand enthält:

- 3-Spalten-Layout mit Header, Sidebar, Viewer und Right Panel
- Findings/Impression-Panels inkl. ASR- und QA-Status (API angebunden, Fallbacks)
- Cornerstone Viewer (Stack, Tools, W/L Presets, Prefetch)
- DICOMweb-Queue für Studien/Serien (Orthanc QIDO-RS)
- Annotation-Export (JSON)
- Prior-Studies-Timeline und Matching-Vorschläge in der Sidebar
- Docker Compose Stack (Frontend + Backend + Orthanc + Postgres)
- Orchestrator-API (FastAPI) inkl. Audit-Logging und QA/Impression-Endpoints
- Inference-Queue (RQ + Redis) mit persistierten Jobs und Status-Events
- DICOM SR Export (JSON + Binary Draft)
- Annex IV Template und Security Baseline in der Compliance-Doku

Orthanc DICOMweb läuft lokal mit Basic Auth, Sample-DICOM wird automatisch geladen.  
ASR/Impression/Inferenz nutzen MedASR/MedGemma wenn aktiviert, sonst Mock-Fallbacks.  
QA verwendet derzeit regelbasierte Mock-Checks.

## Schnellstart

```bash
# Standard (CPU)
docker compose up --build

# Mit NVIDIA GPU
docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up --build

# Mit AMD ROCm
docker compose -f docker-compose.yml -f docker/compose/gpu.yml -f docker/compose/rocm.yml --profile rocm up --build

# Mit Whisper ASR
docker compose -f docker-compose.yml -f docker/compose/whisper.yml up --build
```

Weitere Details: [Development Setup](development/setup.md)
