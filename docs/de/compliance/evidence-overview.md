# Nachweise-Übersicht

Alle Compliance-Artefakte für eine EU-KI-Verordnung-Konformitätsbewertung, gruppiert nach Artikel. Diese Seite dient als Checkliste zur Audit-Vorbereitung.

---

## Anleitung

Jede Zeile enthält:

- **Artefakt** — was das Nachweis-Element ist
- **Fundort** — wo es im Repository oder System zu finden ist
- **Format** — Dateityp / Exportformat
- **Export** — Befehl oder UI-Pfad zum Abrufen

Nachweispakete vor jeder Notified-Body-Prüfung, regulatorischen Einreichung oder internen Compliance-Prüfung erstellen.

---

## Art. 9 — Risikomanagement

| Artefakt | Fundort | Format | Export |
|---|---|---|---|
| Risikomanagementplan | `docs/en/compliance/risk-management.md` | Markdown | Aus Repository herunterladen |
| FMEA-Tabelle | `docs/en/compliance/risk-management.md` (§ FMEA) | Markdown-Tabelle | Kopieren / drucken |
| Mitigationsnachweis — Menschliche Aufsicht | `docs/en/compliance/annex-iv.md` § 9 | Markdown | Aus Repository herunterladen |
| Restrisiko-Akzeptanzprotokoll | `docs/en/compliance/risk-management.md` (§ Restrisiko) | Markdown | Aus Repository herunterladen |

**Status:** Teilweise abgeschlossen. FMEA-Vorlage vorhanden; formale FMEA mit klinischem Input ist offener Punkt.

---

## Art. 10 — Daten-Governance

| Artefakt | Fundort | Format | Export |
|---|---|---|---|
| Datenschutzrichtlinie | `docs/en/compliance/datenschutz.md` | Markdown | Aus Repository herunterladen |
| DSGVO-Verarbeitungsverzeichnis (Art. 30) | `docs/en/compliance/datenschutz.md` (§ Art. 30) | Markdown-Tabelle | Herunterladen / drucken |
| PHI-in-Logs-Richtlinie | `docs/en/operations/security.md` | Markdown | Aus Repository herunterladen |
| DICOM-Anonymisierungsrichtlinie | `docs/en/compliance/datenschutz.md` (§ Anonymisierung) | Markdown | Aus Repository herunterladen |
| Trainingsdaten-Dokumentation | `docs/en/research/medgemma.md` (§ Trainingsdaten) | Markdown | Aus Repository herunterladen |

**Status:** Teilweise abgeschlossen. Kernrichtlinie dokumentiert; Art.-30-Register benötigt organisationsspezifische Vervollständigung.

---

## Art. 11 — Technische Dokumentation

| Artefakt | Fundort | Format | Export |
|---|---|---|---|
| Annex-IV-Vorlage (ausgefüllt) | `docs/en/compliance/annex-iv.md` | Markdown | Aus Repository herunterladen |
| Systemarchitektur-Übersicht | `docs/en/architecture/overview.md` | Markdown + Diagramme | Aus Repository herunterladen |
| Datenfluss-Diagramm | `docs/en/architecture/data-flow.md` | Markdown + Diagramm | Aus Repository herunterladen |
| MedGemma-Modellkarte | `docs/en/research/medgemma.md` | Markdown | Aus Repository herunterladen |
| Validierungs-/Benchmark-Ergebnisse | `docs/en/research/validation.md` | Markdown + Tabellen | Aus Repository herunterladen |

**Status:** Teilweise abgeschlossen. Architektur dokumentiert; Validierungsergebnisse erfordern standortspezifische klinische Tests.

---

## Art. 12 — Audit-Logging

| Artefakt | Fundort | Format | Export |
|---|---|---|---|
| Audit-Log-Schema | `docs/en/compliance/audit-logging.md` | Markdown | Aus Repository herunterladen |
| Live-Audit-Event-Export | `/api/v1/audit?export=json` | JSON | Siehe Befehl unten |
| Audit-Event-Anzahl / Periodenreport | PostgreSQL `audit_events`-Tabelle | SQL / CSV | Siehe Befehl unten |

**Export-Befehle:**

```bash
# Vollständiger Audit-Log-Export (JSON)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/audit?export=json" \
  > audit_export_$(date +%Y%m%d).json

# Anzahl nach Event-Typ (SQL)
docker compose exec postgres psql -U postgres radiolyze \
  -c "SELECT event_type, COUNT(*) FROM audit_events GROUP BY event_type ORDER BY COUNT DESC;"
```

**Status:** Aktiv. Audit-Logger speichert Events für alle 7 definierten Logging-Punkte.

---

## Art. 13 — Transparenz

| Artefakt | Fundort | Format | Export |
|---|---|---|---|
| Benutzer-seitige KI-Warnung (UI) | Befundungs-Workspace-Header | Screenshot | Browser-Screenshot |
| KI-Fähigkeits-Dokumentation | `docs/en/doctors/ki-grundlagen.md` | Markdown | Aus Repository herunterladen |
| Modellversions-Anzeige in UI | Befundungs-Workspace → KI-Panel | Screenshot | Browser-Screenshot |

**Status:** UI-Transparenzelemente aktiv.

---

## Art. 14 — Menschliche Aufsicht

| Artefakt | Fundort | Format | Export |
|---|---|---|---|
| Menschliche-Aufsicht-Design-Beschreibung | `docs/en/compliance/annex-iv.md` § 9 | Markdown | Aus Repository herunterladen |
| Freigabe-Dialog-Spezifikation | `docs/en/doctors/workflow-befundung.md` § 7 | Markdown | Aus Repository herunterladen |
| Override-/Bearbeitungsfähigkeit | `docs/en/doctors/ki-grundlagen.md` (§ Einschränkungen) | Markdown | Aus Repository herunterladen |

**Status:** Menschlicher Aufsichts-Workflow vollständig implementiert.

---

## Art. 15 — Robustheit & Cybersicherheit

| Artefakt | Fundort | Format | Export |
|---|---|---|---|
| Security-Hardening-Leitfaden | `docs/en/admin/security-hardening.md` | Markdown | Aus Repository herunterladen |
| Internetzutzungs-Richtlinie | `docs/en/operations/internet-usage.md` | Markdown | Aus Repository herunterladen |
| Penetrationstest-Bericht | (extern) | PDF | Qualifizierten Sicherheitsdienstleister beauftragen |
| Abhängigkeits-Schwachstellen-Scan | `pip-audit` / `npm audit` ausführen | Text | Siehe Befehl unten |

```bash
# Python-Abhängigkeiten
pip-audit --requirement backend/requirements.txt

# Node-Abhängigkeiten
cd frontend && npm audit --audit-level=high
```

**Status:** Hardening dokumentiert. Formaler Penetrationstest ist offener Punkt für Produktion.

---

## Art. 72 — Post-Market-Monitoring

| Artefakt | Fundort | Format | Export |
|---|---|---|---|
| Post-Market-Monitoring-Plan | `docs/en/compliance/annex-iv.md` § 12 | Markdown | Aus Repository herunterladen |
| Drift-Monitoring-Setup | `docs/en/operations/observability.md` | Markdown | Aus Repository herunterladen |
| QA-Akzeptanzrate-Bericht | `/api/v1/monitoring/drift` | JSON | `curl http://localhost:8000/api/v1/monitoring/drift` |
| Incident-Response-Verfahren | `docs/en/operations/runbook.md` § Incident Response | Markdown | Aus Repository herunterladen |

**Status:** Drift-Endpunkt aktiv. Formale KPI-Dashboards sind offene Punkte.

---

## Nachweispaket generieren

```bash
#!/bin/bash
EXPORT_DIR="./compliance-evidence-$(date +%Y%m%d)"
mkdir -p "$EXPORT_DIR"

# 1. Audit-Log
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/audit?export=json" \
  > "$EXPORT_DIR/audit_events.json"

# 2. Drift-Metriken
curl -s "http://localhost:8000/api/v1/monitoring/drift" \
  > "$EXPORT_DIR/drift_metrics.json"

# 3. Dokumentations-Snapshot
cp -r docs/ "$EXPORT_DIR/docs/"

echo "Nachweispaket erstellt: $EXPORT_DIR"
```

---

## Offene Punkte

| Punkt | Artikel | Priorität |
|---|---|---|
| Formale FMEA mit klinischem Input | Art. 9 | Hoch |
| Organisationsspezifisches Art.-30-Register | Art. 10 | Hoch |
| Standortspezifische klinische Validierungsergebnisse | Art. 11 | Hoch |
| Penetrationstest-Bericht | Art. 15 | Hoch |
| KPI-/Drift-Dashboard | Art. 72 | Mittel |
| Formales Incident-Register | Art. 72 | Mittel |

---

## Verwandte Seiten

- [Compliance-Checkliste](checklist.md)
- [Annex IV Technische Dokumentation](annex-iv.md)
- [Audit Logging](audit-logging.md)
- [Risikomanagement](risk-management.md)
- [EU-KI-Verordnung-Mapping](eu-ai-act-mapping.md)
