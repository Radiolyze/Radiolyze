# Annex IV Technische Dokumentation

Diese Datei folgt der Struktur von Annex IV (EU AI Act) fuer High-Risk-Systeme.
Sie beschreibt den aktuellen Stand der technischen Dokumentation und markiert
Luecken, die vor einer Konformitaetsbewertung zu schliessen sind.

## 1. Systemidentifikation

- **Produktname:** Radiolyze Radiologie Reporting
- **Anbieter:** (TBD Organisation/Legal Entity)
- **Version:** v0.1.x (Repo-Stand)
- **Deployment:** On-Prem (Docker Compose), optional GPU-Profil
- **Kontakt:** (TBD Security/Compliance Kontakt)

## 2. Zweckbestimmung (Intended Purpose)

- Assistenzsystem fuer radiologische Befundung und Reporting.
- Unterstuetzung bei Impression/QA/ASR, jedoch keine autonome Diagnose.
- Jeder KI-Output unterliegt obligatorischer menschlicher Pruefung und Freigabe.
- Nutzergruppen: Radiologen, QA-Personal, Admins (technischer Betrieb).
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

### 5.1 DICOM-Datenfluss

- Rohdaten verbleiben in Orthanc (on-prem Mini-PACS); kein Transfer an externe Dienste.
- Zugriff ausschliesslich ueber DICOMweb (QIDO-RS, WADO-RS) mit Basic-Auth.
- Keine persistente Speicherung von Pixeldaten im Orchestrator-Backend.

### 5.2 PHI-Handling

- PHI (Patient Health Information) wird **nicht** in Logs geschrieben.
- Audit Events enthalten: Event-Typ, Actor-ID, Study-ID (kein Patientenname/Geburtsdatum).
- Input-Hashing: DICOM-Metadaten werden als SHA-256-Hash fuer Reproduzierbarkeit gespeichert.

### 5.3 Anonymisierung

- Anonymisierungsmodul: `backend/app/anonymize.py` implementiert DICOM-Tag-Reduktion.
- Strategie: Entfernung von Tags gemaess DICOM Basic Application Level Confidentiality Profile (PS 3.15 Annex E).
- Pflicht-Tags fuer Anonymisierung: PatientName, PatientID, PatientBirthDate, InstitutionName,
  ReferringPhysicianName, StudyDate (optional pseudonymisiert), AccessionNumber.
- Anwendung: Bei Export fuer Training/Forschung; fuer regulaeren Betrieb nicht automatisch aktiviert.
  Policy: Anonymisierungspflicht muss in der Betreiberorganisation geregelt werden.

### 5.4 Trainingsdaten-Governance

- Radiolyze verwendet MedGemma (Google) als vortrainiertes Modell – kein eigenes Training.
- Fuer Fine-Tuning (optionales Training-Modul `backend/app/api/training.py`):
  - Nur anonymisierte Datensaetze (5.3) duerfen als Trainingsgrundlage verwendet werden.
  - Annotationen werden in `annotations`-Tabelle mit Annotator-ID und Zeitstempel gespeichert.
  - Daten-Lineage: Jeder Annotationsdatensatz verweist auf Study-/Series-UID.
- Retention Policy: Trainingsannotationen unterliegen den klinischen Aufbewahrungsfristen
  (mind. 10 Jahre gemaess DSGVO Art. 5 i.V.m. klinikeigenem Datenschutzkonzept).

## 6. Modellinformationen

- **Inference Model:** MedGemma (multimodal), konfigurierbar via `VLLM_BASE_URL`.
- **ASR:** MedASR (lokal/GPU-Cluster) oder OpenAI-kompatibler Whisper-Dienst.
- Modell-Versionen werden in Audit Events festgehalten (Feld `model_version`).
- Vollstaendige Model Cards: `docs/compliance/model-card-medgemma.md`

## 7. Leistungsmetriken & Validierung

Implementierte Metriken (Drift-Monitoring-Endpunkt `/api/v1/monitoring/drift`):

| Metrik | Beschreibung | Zielwert |
|--------|-------------|----------|
| QA Pass-Rate | Anteil Berichte mit QA-Status "pass" | ≥ 80 % |
| QA Failure-Rate | Anteil Berichte mit QA-Status "fail" | ≤ 5 % |
| Inference-Fehlerrate | Fehlgeschlagene Inference-Jobs / Gesamtjobs | ≤ 2 % |
| Inference-Confidence (Median) | Median der KI-Konfidenzwerte | ≥ 0.7 |
| Turnaround-Zeit | Queue → Result (Median) | ≤ 30 s |

Drift-Monitoring wird automatisch alle `DRIFT_SCHEDULE_HOURS` Stunden (Standard: 24 h)
durch den APScheduler-Job in `backend/app/main.py` ausgefuehrt.

## 8. Risikoanalyse & Mitigation (Art. 9)

### 8.1 FMEA-Tabelle (nach ISO 14971)

| # | Failure Mode | Ursache | Auswirkung | Schwere (S) | Wahrsch. (W) | RPN | Mitigation |
|---|-------------|---------|-----------|------------|-------------|-----|-----------|
| R-01 | KI-Ausgabe falsch-positiv | Modell-Fehler / unbekannte Bildqualitaet | Unnoetige Folgeuntersuchung | 3 | 2 | 6 | Human-Oversight-Pflicht; Radiologe prueft und bearbeitet jeden Output |
| R-02 | KI-Ausgabe falsch-negativ | Seltenes Erscheinungsbild; Bildqualitaet | Uebersehene Pathologie | 5 | 2 | 10 | KI ist Assistenz, kein Ersatz; Freigabe-Dialog; QA-Checks |
| R-03 | PHI in Logs / Audit-Trail | Fehlerhafte Log-Konfiguration | Datenschutzverstoß (DSGVO) | 4 | 1 | 4 | Log-Sanitization; PHI-freies Audit-Schema; Code-Review |
| R-04 | Fehlende Voruntersuchung | Falsche Prior-Studie gewaehlt | Fehlerhafter Vergleich | 3 | 2 | 6 | UI-Warnung bei Prior-Diskrepanz; Time-Delta-Anzeige |
| R-05 | Session-Timeout waehrend Inference | Netzwerk-/Redis-Fehler | Verlorene Job-Ergebnisse | 2 | 2 | 4 | RQ-Job-Persistenz in DB; Status-Polling; Retry-Logik |
| R-06 | Unauthorisierter Zugriff | Schwaches Passwort / fehlende MFA | Datenleck, Manipulation | 5 | 1 | 5 | JWT-Auth; RBAC; Rate-Limiting; Passwort-Policy; TLS |
| R-07 | Modell-Drift unerkannt | Datenverschleppung; Verteilungsaenderung | Sinkende Diagnosequalitaet | 4 | 2 | 8 | Automatischer Drift-Scheduler (APScheduler, 24h); Alert-Schwellwerte |
| R-08 | DICOM SR falsch archiviert | STOW-RS-Fehler / Orthanc-Ausfall | Verlorener Befund | 4 | 1 | 4 | STOW-RS Error-Handling; Retry; Orthanc Health-Check |
| R-09 | Deployment fehlkonfiguriert | Fehlende ENV-Variablen | Systemausfall / Mock-Modus | 3 | 2 | 6 | Startup-Validation (`validate_jwt_config`); Health-Endpoint; env.example |

**Skala:** S (Schwere) und W (Wahrscheinlichkeit) je 1–5; RPN = S × W.
**Akzeptanzgrenze:** RPN ≥ 10 erfordert praezise Mitigation und Re-Evaluierung.

### 8.2 Residual-Risiko

Nach Mitigation betraegt das hoechste Residual-RPN 6 (R-02 nach Human-Oversight-Pflicht).
Das System ist als **Assistenz**system klassifiziert; finale Entscheidung liegt beim Arzt.

## 9. Human Oversight (Art. 14)

- Freigabe-Dialog fuer Report-Finalisierung (obligatorisch).
- Jeder KI-Output ist editierbar; UI zeigt KI-Status und QA-Ergebnis.
- Fallbacks bei Inference/ASR-Fehlern blockieren den Workflow nicht.
- Audit Trail dokumentiert, ob ein Output modifiziert wurde.

## 10. Logging & Traceability (Art. 12)

- Audit Event Schema: `docs/compliance/audit-logging.md`
- Ereignisse: Report Create/Open/Approve, ASR, QA, Inference Queue/Worker.
- Metadata: Model Version, Input Hash, Output Summary (gekuerzt, kein PHI).
- `evidence_indices` verknuepfen KI-Findings mit den DICOM-Frame-Referenzen.

## 11. Cybersecurity & Robustheit (Art. 15)

- TLS-Terminierung fuer alle oeffentlichen Endpunkte (Konfiguration: `docker/nginx.conf`).
- AuthN via JWT (RS256); RBAC-Rollen: radiologe, qa, admin.
- Netzwerksegmentierung: DB/Redis/Orthanc nicht oeffentlich erreichbar.
- Rate-Limiting (Redis-backed) fuer sensible Endpunkte (`/auth/login`, `/inference/queue`).
- Security-Headers-Middleware: CSP, X-Frame-Options, HSTS (bei aktiviertem TLS).
- Security Policy: `docs/operations/security.md`

## 12. Post-Market Monitoring (Art. 72)

- Drift-Monitoring: APScheduler (`DRIFT_SCHEDULE_HOURS=24`) + `/api/v1/monitoring/drift`.
- KPI-Schwellwerte: QA-Pass-Rate, Inference-Confidence, Fehlerrate (siehe Abschnitt 7).
- Incident-Prozess: Schwere Incidents (RPN ≥ 8) loesen sofortigen Review aus;
  Dokumentation in Audit Trail mit Event-Typ `incident_reported`.

## 13. Aenderungs- & Release-Management

- Modell-Versionierung ueber ENV-Variable `VLLM_MODEL` + Audit Events.
- Release Notes + Approval Gate fuer Produktionsdeployments.
- Update-Prozess mit SHA-256-Hash-Verifikation fuer DICOM-Inputs.

## 14. Anhaenge / Nachweis-Artefakte

- Audit Log Export (JSON): `/api/v1/audit?export=json`
- QA Reports (CSV/JSON): `/api/v1/reports/{id}/qa`
- Drift Snapshots: `/api/v1/monitoring/drift`
- Model Version History: Audit Events mit `event_type=inference_*`
- Security Konzept: `docs/operations/security.md`
- Test Reports: CI-Ausgabe (`.github/workflows/ci.yml`)
- Anonymisierungsmodul: `backend/app/anonymize.py`
- Model Card MedGemma: `docs/compliance/model-card-medgemma.md`

## 15. Offene Punkte

| Punkt | Status | Prioritaet |
|-------|--------|-----------|
| FMEA vollstaendig ausgefuellt | ✅ Abschnitt 8.1 | – |
| Data-Governance-Outline | ✅ Abschnitt 5 | – |
| Model Card MedGemma | ✅ `model-card-medgemma.md` | – |
| KPI/Drift-Dashboard | ✅ APScheduler + `/api/v1/monitoring/drift` | – |
| RBAC vollstaendig implementiert | ⚠️ Rollen vorhanden; OIDC/MFA offen | Hoch |
| TLS-Konfiguration in docker-compose.yml | ⚠️ GAP-11 | Mittel |
| Notified-Body-Audit-Vorbereitung | ⚠️ Erfordert finale Rechtsform des Anbieters | Hoch |
