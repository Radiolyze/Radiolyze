# MedGemma Radiologie Reporting UI

Willkommen zur Dokumentation des MedGemma Radiologie Reporting UI. Dieses Projekt liefert
eine realistische, workflow-orientierte UI fuer radiologische Befunde mit Fokus auf
Speed, Genauigkeit, Accessibility und EU-AI-Act-Konformitaet.

Die Dokumentation beschreibt:

- Zielarchitektur (Open Stack: Orthanc, MedASR, MedGemma, FastAPI)
- UI/UX Komponenten und Workflows
- Backend-Endpunkte und WebSocket-Schnittstellen
- Compliance- und Audit-Logging
- Betrieb, Security, Observability
- Roadmap und offene Aufgaben

## Quick Links

- [Architektur Uebersicht](architecture/overview.md)
- [Frontend](architecture/frontend.md)
- [Backend](architecture/backend.md)
- [Compliance](architecture/compliance.md)
- [API Schemas](api/schemas.md)
- [Workflows](workflows/overview.md)
- [Roadmap](roadmap.md)

## Projektstatus (Kurz)

Der aktuelle Code enthaelt:

- 3-Spalten-Layout mit Header, Sidebar, Viewer, Right Panel
- Findings/Impression Panels inkl. ASR- und QA-Status (API angebunden, Fallbacks)
- Cornerstone Viewer (Stack, Tools, W/L Presets, Prefetch)
- DICOMweb Queue fuer Studien/Serien (Orthanc QIDO-RS)
- Annotation Export (JSON)
- Prior Studies Timeline + Matching-Vorschlaege in der Sidebar
- Docker Compose Stack (Frontend + Backend + Orthanc + Postgres)
- Orchestrator API (FastAPI) inkl. Audit Logging und QA/Impression Endpoints
- Inference Queue (RQ + Redis) mit persistierten Jobs und Status-Events
- DICOM SR Export (JSON + Binary Draft)
- Annex IV Template + Security Baseline in der Compliance Doku

Orthanc DICOMweb laeuft lokal mit Basic Auth, Sample-DICOM wird automatisch geladen.
ASR/QA/Impression/Inferenz verwenden im Backend derzeit Mock-Logik als Platzhalter.
