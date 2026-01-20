# API Endpunkte (Soll)

## Reports

`POST /api/v1/reports/create`
- Erstellt Report und startet Pipeline

`GET /api/v1/reports/{report_id}`
- Liefert Status und Inhalte

`POST /api/v1/reports/{report_id}/finalize`
- Freigabe durch Radiologe, erzeugt DICOM SR

## ASR

`POST /api/v1/reports/asr-transcript`
- Upload von Audio oder Stream

## Impression

`POST /api/v1/reports/generate-impression`
- Generiert KI-Entwurf

## QA

`POST /api/v1/reports/qa-check`
- QA Pruefungen

## Audit

`POST /api/v1/audit-log`
- Audit Event schreiben

`GET /api/v1/audit-log?study_id=...`
- Audit Log lesen
