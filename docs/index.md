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
- Findings/Impression Panels inkl. ASR- und QA-Status
- Viewer UI mit Tools, SeriesStack und ProgressOverlay
- Mock-Daten fuer Queue, Reports, Templates, Guidelines

Die Integration von Orthanc/MedASR/MedGemma ist vorbereitet, aber im UI noch als Mock
oder Platzhalter umgesetzt.
