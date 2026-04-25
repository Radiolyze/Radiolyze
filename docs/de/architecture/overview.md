# Architektur Uebersicht

## Ziele

- Radiologist-First Design mit Zero-Click Workflow
- Dark Mode Default und hohe Kontraste (WCAG 2.1 AA)
- Echtzeit-Feedback fuer ASR, AI-Inferenz, QA
- EU-AI-Act konforme Audit-Trails und Human Oversight

## Systemuebersicht

Die Architektur nutzt einen offenen, privacy-erhaltenden Stack:

- **Frontend**: React + TypeScript, Cornerstone-basierter Viewer
- **DICOM**: Orthanc als Mini-PACS und DICOMweb Provider
- **Orchestrator**: FastAPI fuer Workflow, Versionierung, Audit Logging
- **ASR**: MedASR (lokal oder GPU-Cluster)
- **Inference**: MedGemma (multimodal), optional LLM fuer Impression
- **RAG**: Guidelines, Templates, institutionelle Inhalte
- **Queue/Worker**: RQ + Redis fuer Inference Jobs und Status-Events

## Architekturprinzipien

1. **Entkopplung**: Viewer und Report-Editing sind separat gekapselt.
2. **Observability**: Jeder Schritt erzeugt Audit-Events.
3. **Fallback**: UI bleibt funktionsfaehig bei Inferenz-Fehlern.
4. **Compliance**: Logging und Human Oversight sind First-Class.

## Kernmodule im Repo

- `src/components/Layout`: Shell, Header
- `src/components/Viewer`: DICOM Viewer UI + Progress Overlay
- `src/components/RightPanel`: Findings, Impression, QA, Templates, Guidelines
- `src/services`: API, Orthanc, WebSocket, Audit Logger
- `src/hooks`: ASR und Shortcuts
