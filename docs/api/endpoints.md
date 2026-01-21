# API Endpunkte (Ist)

## Health

`GET /api/v1/health`
- Health Check fuer Orchestrator

## Reports

`POST /api/v1/reports/create`
- Erstellt Report (DB), optional mit `report_id`

`GET /api/v1/reports?status=...&limit=...&offset=...`
- Listet Reports (DB), optional Status Filter

`GET /api/v1/reports/{report_id}`
- Liefert Report Status und Inhalte

`PATCH /api/v1/reports/{report_id}`
- Aktualisiert Findings/Impression/Status eines Reports
- Schreibt Audit Event (`findings_saved`, `report_amended`, `report_updated`)

`POST /api/v1/reports/{report_id}/finalize`
- Freigabe durch Radiologe, setzt Status auf `finalized`
- DICOM SR Export via separatem Endpoint

`GET /api/v1/reports/{report_id}/export-sr?format=json|dicom`
- Exportiert einen DICOM SR Entwurf als JSON (`application/dicom+json`) oder Binary (`application/dicom`)
- Erstellt einen Audit Event `report_exported` mit Format

## ASR

`POST /api/v1/reports/asr-transcript`
- Upload von Audio (multipart/form-data: `file`, optional `report_id`)
- Backend nutzt MedASR wenn aktiviert, sonst Mock-ASR

## Impression

`POST /api/v1/reports/generate-impression`
- Generiert KI-Entwurf (vLLM wenn aktiviert, sonst Mock)
- Update von `impression_text` im Report, falls `report_id` gesetzt
- Optional: `image_urls`/`image_paths` fuer Multimodal Inputs

## Inference

`POST /api/v1/inference/queue`
- Legt einen Inference Job in der Queue an (RQ + Redis)
- Gibt `job_id` und Status zurueck
- Optional: `image_urls`/`image_paths` fuer Multimodal Inputs

`GET /api/v1/inference/status/{job_id}`
- Liefert Status + Ergebnis (aus DB, Fallback auf RQ Job)

## QA

`POST /api/v1/reports/qa-check`
- QA Pruefungen (Mock-Logik)
- Response enthaelt `checks`, `warnings`, `failures`, `quality_score`
- Update von `qa_status` und `qa_warnings`, falls `report_id` gesetzt

## Audit

`POST /api/v1/audit-log`
- Audit Event schreiben (persistiert in DB)

`GET /api/v1/audit-log?study_id=...`
- Audit Log lesen (Filter `study_id`, `report_id`)
