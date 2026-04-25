# EU AI Act Mapping

Diese Tabelle ordnet die Anforderungen den implementierten Komponenten zu und
dokumentiert den aktuellen Umsetzungsstand.

| Artikel | Anforderung | Umsetzung | Status |
|---------|------------|-----------|--------|
| Art. 9 | Risk Management | FMEA-Tabelle (Annex IV § 8.1); Human-Oversight-Pflicht; QA-Checks | ✅ Dokumentiert |
| Art. 10 | Data Governance | DICOM via Orthanc (on-prem); Anonymisierungsmodul (`anonymize.py`); Data-Governance-Outline (Annex IV § 5) | ✅ Dokumentiert |
| Art. 11 | Technische Dokumentation | `docs/compliance/annex-iv.md`; Model Card (`model-card-medgemma.md`); Architektur-Docs | ✅ Vollstaendig |
| Art. 12 | Logging & Traceability | Audit Logger (`backend/app/audit.py`); PostgreSQL `audit_events`; `evidence_indices` fuer Bild-Referenzen | ✅ Implementiert |
| Art. 13 | Transparenz | UI-Statusanzeige (KI-Konfidenz, Model-Version, QA-Status); Human-Override immer moeglich | ✅ Implementiert |
| Art. 14 | Human Oversight | Freigabe-Dialog (obligatorisch); alle KI-Outputs editierbar; Fehler-Fallbacks | ✅ Implementiert |
| Art. 15 | Robustheit & Cybersecurity | JWT-Auth; RBAC; Rate-Limiting; Security-Headers-Middleware; TLS-Konfiguration (GAP-11) | ⚠️ TLS ausstehend |
| Art. 72 | Post-Market Monitoring | APScheduler Drift-Snapshot (24h); KPI-Dashboard (`/api/v1/monitoring/drift`) | ✅ Implementiert |
| Annex IV | Technische Dokumentation | `docs/compliance/annex-iv.md` | ✅ Vollstaendig |

## Nachweis-Artefakte

| Artefakt | Quelle | Format |
|---------|--------|--------|
| Audit Log Export | `GET /api/v1/audit?export=json` | JSON |
| QA Reports | `GET /api/v1/reports/{id}/qa` | JSON |
| Drift Snapshots | `GET /api/v1/monitoring/drift` | JSON |
| Model Version History | Audit Events (`event_type=inference_*`) | DB / JSON Export |
| Security Tests | CI-Pipeline (`.github/workflows/ci.yml`) | JUnit XML |
| Anonymisierungsmodul | `backend/app/anonymize.py` | Python |
| FMEA-Tabelle | `docs/compliance/annex-iv.md` § 8.1 | Markdown |
| Model Card | `docs/compliance/model-card-medgemma.md` | Markdown |

## Offene Punkte bis zur Konformitaetsbewertung

| # | Punkt | Prioritaet | Referenz |
|---|-------|-----------|---------|
| 1 | TLS-Terminierung in `docker/nginx.conf` | Hoch | GAP-11, Issue #40 |
| 2 | OIDC/MFA fuer Produktionsdeployments | Hoch | Annex IV § 11 |
| 3 | Notified-Body-Auswahl und formale Konformitaetsbewertung | Hoch | Annex IV § 1 |
| 4 | Lokale klinische Validierungsstudie (Sensitivitaet/Spezifizitaet) | Mittel | Art. 9 |
| 5 | Betreiber-spezifisches Datenschutzkonzept (DSGVO Art. 30 Verzeichnis) | Hoch | Art. 10 |
