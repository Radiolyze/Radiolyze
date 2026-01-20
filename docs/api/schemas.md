# API Schemas

Diese Schemas dienen als Referenz fuer die geplanten REST-Endpunkte.
Sie sind bewusst einfach gehalten und koennen spaeter als OpenAPI exportiert werden.

## ReportCreateRequest

```json
{
  "study_id": "st-123",
  "modality": "CT",
  "radiologist_id": "u-001",
  "audio_url": "https://storage.local/audio/123.webm"
}
```

## ReportResponse

```json
{
  "report_id": "r-123",
  "status": "pending",
  "findings_text": "",
  "impression_text": "",
  "confidence_scores": {
    "asr": 0.94,
    "ai": 0.91
  },
  "created_at": "2026-01-20T10:05:00Z",
  "updated_at": "2026-01-20T10:05:00Z"
}
```

## ReportFinalizeRequest

```json
{
  "radiologist_approval": true,
  "radiologist_edits": "Impression: ...",
  "signature": "Dr. Radiologe"
}
```

## QAResponse

```json
{
  "passes": true,
  "failures": [],
  "warnings": [
    "Follow-up Empfehlung pruefen"
  ],
  "quality_score": 85
}
```

## AuditLogEntry

```json
{
  "event_type": "report_finalized",
  "actor_id": "u-001",
  "study_id": "st-123",
  "report_id": "r-123",
  "model_version": "medgemma-1.5-4b-it",
  "inference_time_ms": 6234,
  "input_hash": "sha256:...",
  "output_summary": "Impression: ...",
  "changes": {
    "qa_score": 85
  },
  "timestamp": "2026-01-20T10:12:00Z"
}
```

## WebSocket Event

```json
{
  "type": "report_status",
  "reportId": "r-123",
  "payload": {
    "asrStatus": "processing",
    "aiStatus": "generating",
    "qaStatus": "checking"
  },
  "timestamp": "2026-01-20T10:08:12Z"
}
```
