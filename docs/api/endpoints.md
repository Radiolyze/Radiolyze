# API Endpunkte (Ist)

Alle Routen liegen unter dem FastAPI-Orchestrator mit Praefix `/api/v1` (Ausnahme: App-Level Health). Die interaktive OpenAPI-Spezifikation steht am laufenden Backend unter `/docs` (Swagger UI).

## Health

`GET /api/v1/health`

- Aggregierter Health-Check (Datenbank, Redis, optional vLLM, MedASR, Orthanc)

## Auth

`POST /api/v1/auth/login`

- Login, liefert JWT

`GET /api/v1/auth/me`

- Aktueller Benutzer (JWT)

`POST /api/v1/auth/users`

- Benutzer anlegen (geschuetzt)

Auth-Verhalten: Umgebungsvariable `AUTH_REQUIRED` (Standard `true`). Bei `false` werden Rollen-Checks fuer die Entwicklung umgangen.

## Reports

`POST /api/v1/reports/create`

- Erstellt Report in der DB, optional mit `report_id`

`GET /api/v1/reports?status=...&limit=...&offset=...`

- Listet Reports, optional Status-Filter

`GET /api/v1/reports/by-patient/{patient_id}`

- Reports eines Patienten

`GET /api/v1/reports/{report_id}`

- Report inkl. Status und Inhalte

`PATCH /api/v1/reports/{report_id}`

- Aktualisiert Findings/Impression/Status; Audit-Events (`findings_saved`, `report_amended`, `report_updated`)

`POST /api/v1/reports/{report_id}/finalize`

- Freigabe, Status `finalized`

`GET /api/v1/reports/{report_id}/export-sr?format=json|dicom`

- DICOM SR Export (JSON oder binaerer Entwurf); Audit `report_exported`

`POST /api/v1/reports/asr-transcript`

- Audio-Upload (multipart: `file`, optional `report_id`); MedASR oder Mock

`POST /api/v1/reports/generate-impression`

- KI-Impression; vLLM wenn aktiviert, sonst Mock

`POST /api/v1/reports/stream-impression`

- Streaming-Variante der Impression

`POST /api/v1/reports/qa-check`

- QA-Pruefungen; Update von `qa_status` / `qa_warnings` bei gesetztem `report_id`

`GET /api/v1/reports/{report_id}/revisions`

- Versionshistorie (Report-Revisions)

`GET /api/v1/reports/{report_id}/export-pdf`

- PDF-Export des Befunds (501 falls nicht verfuegbar)

`POST /api/v1/reports/{report_id}/check-critical`

- Kritische Befunde pruefen, Alerts anlegen

`GET /api/v1/reports/{report_id}/critical-alerts`

- Liste kritischer Alerts

`PATCH /api/v1/reports/{report_id}/critical-alerts/{alert_id}/acknowledge`

- Alert quittieren

`POST /api/v1/reports/{report_id}/request-review`

- Peer Review anfordern

`GET /api/v1/reports/{report_id}/reviews`

- Peer Reviews zu einem Report

`POST /api/v1/reports/{report_id}/reviews/{review_id}/submit`

- Peer Review einreichen

## Inference

`GET /api/v1/inference/schemas`

- JSON-Schemas fuer Inference-Requests

`POST /api/v1/inference/queue`

- Job in RQ-Queue; optional multimodale Bilder (`image_urls` / `image_paths`)

`POST /api/v1/inference/localize`

- Lokalisierungs-Inferenz (Queue)

`GET /api/v1/inference/status/{job_id}`

- Status und Ergebnis (DB, Fallback RQ-Job)

## Prompts

`GET /api/v1/prompts`

- Aktive Prompt-Templates inkl. Metadaten (`editable`, `maxLength`, `allowedVariables`)

`GET /api/v1/prompts/{prompt_type}`

- Aktiver Prompt fuer `system|summary|impression`

`PUT /api/v1/prompts/{prompt_type}`

- Prompt aktualisieren (Versionierung + Aktivierung)

## QA-Regeln

`GET /api/v1/qa-rules`

- Liste der QA-Regeln

`POST /api/v1/qa-rules`

- Regel anlegen

`PATCH /api/v1/qa-rules/{rule_id}`

- Regel aktualisieren

`DELETE /api/v1/qa-rules/{rule_id}`

- Regel loeschen

## Report-Templates

`GET /api/v1/report-templates`

- Templates auflisten

`POST /api/v1/report-templates`

- Template anlegen

`POST /api/v1/report-templates/populate`

- Template mit Kontext befuellen

`GET /api/v1/report-templates/{template_id}/schema`

- Schema eines Templates

## Guidelines

`GET /api/v1/guidelines/search`

- Guidelines durchsuchen

`GET /api/v1/guidelines`

- Guidelines auflisten

`POST /api/v1/guidelines`

- Guideline anlegen

`PATCH /api/v1/guidelines/{guideline_id}`

- Guideline aktualisieren

`DELETE /api/v1/guidelines/{guideline_id}`

- Guideline loeschen

## Annotationen

`POST /api/v1/annotations`

- Annotation anlegen

`GET /api/v1/annotations`

- Annotationen auflisten (Filter je nach Query-Parametern)

`GET /api/v1/annotations/{annotation_id}`

- Einzelne Annotation

`PATCH /api/v1/annotations/{annotation_id}`

- Annotation aktualisieren

`DELETE /api/v1/annotations/{annotation_id}`

- Annotation loeschen

`POST /api/v1/annotations/{annotation_id}/verify`

- Annotation verifizieren

## Training / Export (Forschung)

`GET /api/v1/training/stats`

- Export-Statistiken

`POST /api/v1/training/export`

- Datenexport

`POST /api/v1/training/manifest`

- Manifest erzeugen

`GET /api/v1/training/categories`

- Kategorien fuer Training/Export

## Monitoring

`GET /api/v1/metrics`

- Metriken (Prometheus-kompatibel je nach Implementierung)

`GET /api/v1/monitoring/drift`

- Drift-Monitoring

`GET /api/v1/monitoring/drift/snapshots`

- Drift-Snapshots

## Audit

`POST /api/v1/audit-log`

- Audit-Event schreiben

`GET /api/v1/audit-log?study_id=...&report_id=...&limit=...&offset=...`

- Audit-Log lesen mit Filter und Pagination

## WebSocket

`WS /api/v1/ws`

- Live-Updates; optional Query-Parameter `token` (JWT). Bei `AUTH_REQUIRED=true` ist gueltiges Token erforderlich.

Siehe auch [WebSocket Events](websocket.md).
