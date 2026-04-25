# Annex IV Technische Dokumentation (Entwurf)

Diese Datei folgt der Struktur von Annex IV (EU AI Act) fuer High-Risk-Systeme.
Sie beschreibt den aktuellen Stand der technischen Dokumentation und markiert
Luecken, die vor einer Konformitaetsbewertung zu schliessen sind.

## 1. Systemidentifikation

- Produktname: Radiolyze Radiologie Reporting
- Anbieter: (TBD Organisation/Legal Entity)
- Version: v0.1.x (Repo-Stand)
- Deployment: On-Prem (Docker Compose), optional GPU Profil
- Kontakt: (TBD Security/Compliance Kontakt)

## 2. Zweckbestimmung (Intended Purpose)

- Assistenzsystem fuer radiologische Befundung und Reporting.
- Unterstuetzung bei Impression/QA/ASR, jedoch keine autonome Diagnose.
- Nutzergruppen: Radiologen, QA, Admins (technischer Betrieb).
- Einsatzumfeld: Kliniken/Radiologie, on-prem, ohne externe Datenabfluesse.

## 3. Systemuebersicht

Komponenten und Datenfluss sind dokumentiert in:

- Architektur: `docs/architecture/overview.md`
- Datenfluss: `docs/architecture/data-flow.md`
- Backend: `docs/architecture/backend.md`
- Frontend: `docs/architecture/frontend.md`

## 4. Systemdesign & Softwarearchitektur

- Frontend: React + TypeScript (Viewer, Reporting, QA, Templates, Guidelines).
- Orchestrator: FastAPI (Report-Workflow, QA, ASR, Inference Queue).
- Queue/Worker: RQ + Redis (Inference Jobs).
- DICOM: Orthanc als Mini-PACS und DICOMweb Provider.
- Storage: Postgres fuer Reports, QA, Audit Events.

## 5. Daten-Governance

- DICOM Datenfluss ueber Orthanc DICOMweb.
- Keine PHI in Client-Logs (Policy, siehe Security).
- Audit Logs minimal halten: Hashes statt Rohdaten.
- Optional: DICOM Anonymisierung fuer Export/Training (Policy TBD).

## 6. Modellinformationen

- Inference Model: MedGemma (multimodal), konfigurierbar via ENV.
- ASR: MedASR (lokal/GPU Cluster).
- Model Versionen werden in Audit Events festgehalten (Queue/Worker).
- Model Cards und Trainingsdaten: referenziert in der Produktdoku (TBD).

## 7. Leistungsmetriken & Validierung

Geplante/zu erhebende Metriken:

- QA Pass/Warn/Fail Rate
- Inference Confidence Verteilung
- Turnaround Time (Queue -> Result)
- Fehlerklassen (ASR, Inference, QA)

Status:

- Baseline-Metriken sind definiert, Messung/Reporting ist geplant.

## 8. Risikoanalyse & Mitigation (Art. 9)

Beispiele fuer identifizierte Risiken:

- Falsche AI-Ausgabe wird als final betrachtet.
- Fehlende oder falsche Voruntersuchungs-Auswahl.
- Datenabfluss/PHI in Logs.

Mitigation:

- Human Oversight (Freigabe-Dialog, Editierbarkeit).
- UI-Transparenz (Status, Model-Version, QA-Checks).
- Audit Logging mit minimalen Datenfeldern.

## 9. Human Oversight (Art. 14)

- Freigabe-Dialog fuer Report Finalisierung.
- Jeder KI-Output ist editierbar; UI zeigt Status und QA.
- Fallbacks bei Inference/ASR Fehlern (kein Blockieren des Workflows).

## 10. Logging & Traceability (Art. 12)

- Audit Event Schema: `docs/compliance/audit-logging.md`
- Ereignisse: Report Create/Open/Approve, ASR, QA, Inference Queue/Worker.
- Metadata: Model Version, Input Hash, Output Summary (gekuerzt).

## 11. Cybersecurity & Robustheit (Art. 15)

- TLS Terminierung fuer alle Endpunkte (Reverse Proxy).
- AuthN/AuthZ via JWT + RBAC (Radiologe, QA, Admin).
- Netzwerksegmentierung (DB/Redis/Orthanc nicht oeffentlich).
- Rate Limiting fuer Uploads/Inference.
- Security Policy: `docs/operations/security.md`

## 12. Post-Market Monitoring (Art. 72)

- Drift Monitoring (geplant): Modell-Performance, QA Trends.
- Incident Prozess (geplant): Severity, Notfall-Patches, Audit Trail.

## 13. Aenderungs- & Release-Management

- Versionierung der Modelle (ENV + Audit Events).
- Release Notes + Approval Gate fuer Prod Deployments.
- Update Prozess mit Hash-Verifikation (siehe Internetnutzung).

## 14. Anhaenge / Nachweis-Artefakte

- Audit Log Export (JSON)
- QA Reports (CSV/JSON)
- Model Version History
- Security Konzept (TLS, Auth, RBAC)
- Test Reports (Unit/Integration, Smoke Tests)

## 15. Offene Punkte (TODO)

- Vollstaendige Risikoanalyse (FMEA/ISO 14971).
- Daten-Governance Doku (Anonymisierung/Training).
- Vollstaendige Model Cards inkl. Trainingsdatenquellen.
- KPI/Drift Dashboards + Monitoring.
- RBAC Implementierung und Auth Provider Auswahl.
