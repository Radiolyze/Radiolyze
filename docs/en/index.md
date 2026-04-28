# Radiolyze

**Radiology workflow system with AI-assisted report generation, DICOM viewer, speech recognition, and EU AI Act-compliant audit logging.**

Radiolyze is an open-source platform that helps radiologists report faster and more consistently — combining a full DICOM viewer, multimodal AI analysis (MedGemma), voice dictation (MedASR/Whisper), structured QA checks, and complete audit logging.

---

## Where do you want to start?

<div class="grid cards" markdown>

-   :material-stethoscope: **I am a radiologist or physician**

    Learn how to use Radiolyze for daily reporting: DICOM viewer, AI-assisted findings, voice dictation, and approval workflow.

    [:octicons-arrow-right-24: Doctor's Guide](doctors/index.md)

-   :material-rocket-launch: **I am new to the project**

    Get up and running in 5 minutes with Docker and the built-in demo data.

    [:octicons-arrow-right-24: Quickstart](getting-started/quickstart.md)

-   :material-flask: **I am a researcher or AI specialist**

    Understand the AI model (MedGemma), replace the inference backend, validate outputs, and explore the data pipeline.

    [:octicons-arrow-right-24: Researcher Guide](research/index.md)

-   :material-server: **I am an IT administrator**

    Deploy, configure, secure, monitor, and maintain Radiolyze in a hospital or private cloud environment.

    [:octicons-arrow-right-24: Administration Guide](admin/index.md)

-   :material-code-braces: **I am a developer**

    Set up the development environment, understand the architecture, and contribute to the codebase.

    [:octicons-arrow-right-24: Development Setup](development/setup.md)

-   :material-scale-balance: **I am a compliance officer**

    Find evidence artefacts, EU AI Act mappings, risk management templates, and the path to conformity assessment.

    [:octicons-arrow-right-24: Compliance Overview](compliance/checklist.md)

</div>

---

## Key Capabilities

<div class="grid cards" markdown>

-   :material-monitor: **DICOM Viewer**

    Cornerstone.js-based stack viewer with tools (zoom, pan, windowing, measurements), series navigation, and prior studies comparison.

    [:octicons-arrow-right-24: Viewer Documentation](components/viewer.md)

-   :material-brain: **AI-Assisted Reporting**

    MedGemma multimodal image analysis for automated findings and impressions with mandatory human oversight dialogs.

    [:octicons-arrow-right-24: Workflows](workflows/overview.md)

-   :material-microphone: **Voice Dictation (ASR)**

    MedASR or self-hosted Whisper for medical dictation with live transcription directly into the findings panel.

    [:octicons-arrow-right-24: Fast Reporting Workflow](workflows/fast-report.md)

-   :material-shield-check: **EU AI Act Compliance**

    Complete audit logging (Art. 12), transparency indicators (Art. 13), human oversight dialogs (Art. 14), and robustness fallbacks (Art. 15).

    [:octicons-arrow-right-24: Compliance Documentation](compliance/checklist.md)

</div>

---

## Quick Start

```bash
# Start the full stack (CPU mode, includes demo DICOM data)
docker compose up --build
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

For GPU acceleration, production deployment, and other options → [Quickstart Guide](getting-started/quickstart.md)

---

!!! warning "Not production-ready out of the box"
    Radiolyze is a reference implementation. It is **not production-ready** without additional configuration:
    authentication/RBAC, TLS, security hardening, and clinical validation.
    See the [Administration Guide](admin/index.md) and [Compliance Checklist](compliance/checklist.md).
