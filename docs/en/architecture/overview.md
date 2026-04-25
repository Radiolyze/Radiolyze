# Architecture Overview

## Goals

- Radiologist-First Design with Zero-Click Workflow
- Dark Mode by default with high contrast (WCAG 2.1 AA)
- Real-time feedback for ASR, AI inference, and QA
- EU AI Act-compliant audit trails and human oversight

## System Overview

The architecture uses an open, privacy-preserving stack:

- **Frontend**: React + TypeScript, Cornerstone-based viewer
- **DICOM**: Orthanc as mini-PACS and DICOMweb provider
- **Orchestrator**: FastAPI for workflow, versioning, and audit logging
- **ASR**: MedASR (local or GPU cluster)
- **Inference**: MedGemma (multimodal), optional LLM for impression generation
- **RAG**: Guidelines, templates, institutional content
- **Queue/Worker**: RQ + Redis for inference jobs and status events

## Architecture Principles

1. **Decoupling**: Viewer and report editing are separately encapsulated.
2. **Observability**: Every step produces audit events.
3. **Fallback**: The UI remains functional when inference fails.
4. **Compliance**: Logging and human oversight are first-class concerns.

## Core Modules in the Repo

- `src/components/Layout`: Shell, header
- `src/components/Viewer`: DICOM viewer UI + progress overlay
- `src/components/RightPanel`: Findings, impression, QA, templates, guidelines
- `src/services`: API, Orthanc, WebSocket, audit logger
- `src/hooks`: ASR and keyboard shortcuts
