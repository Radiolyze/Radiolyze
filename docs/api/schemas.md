# API Schemas (Ist)

Diese Schemas spiegeln die aktuell implementierten Endpunkte wider.
Die OpenAPI kann im Backend unter `/docs` eingesehen werden.

## ReportCreateRequest

```json
{
  "study_id": "st-123",
  "patient_id": "p-001",
  "status": "pending",
  "findings_text": "",
  "impression_text": "",
  "report_id": "r-optional"
}
```

## ReportResponse

```json
{
  "id": "r-123",
  "study_id": "st-123",
  "patient_id": "p-001",
  "status": "draft",
  "findings_text": "",
  "impression_text": "",
  "created_at": "2026-01-20T10:05:00Z",
  "updated_at": "2026-01-20T10:05:00Z",
  "approved_at": null,
  "approved_by": null,
  "qa_status": "warn",
  "qa_warnings": [
    "Fleischner-Kriterien fuer Rundherd pruefen."
  ],
  "inference_status": "finished",
  "inference_summary": "Automatische Bildanalyse: ...",
  "inference_confidence": 0.84,
  "inference_model_version": "medgemma-v2",
  "inference_job_id": "job-123",
  "inference_completed_at": "2026-01-20T10:12:00Z"
}
```

## ReportFinalizeRequest

```json
{
  "approvedBy": "Dr. Radiologe",
  "signature": "Dr. Radiologe"
}
```

## ReportUpdateRequest

```json
{
  "findings_text": "Befund ...",
  "impression_text": "Beurteilung ...",
  "status": "draft",
  "actorId": "dr-radiologe"
}
```

## ReportListResponse

```json
[
  {
    "id": "r-123",
    "study_id": "st-123",
    "patient_id": "p-001",
    "status": "draft",
    "findings_text": "",
    "impression_text": "",
    "created_at": "2026-01-20T10:05:00Z",
    "updated_at": "2026-01-20T10:05:00Z",
    "approved_at": null,
    "approved_by": null,
    "qa_status": "warn",
    "qa_warnings": [
      "Fleischner-Kriterien fuer Rundherd pruefen."
    ],
    "inference_status": "finished",
    "inference_summary": "Automatische Bildanalyse: ...",
    "inference_confidence": 0.84,
    "inference_model_version": "medgemma-v2",
    "inference_job_id": "job-123",
    "inference_completed_at": "2026-01-20T10:12:00Z"
  }
]
```

## ASRResponse

```json
{
  "text": "Im CT Thorax mit Kontrastmittel ...",
  "confidence": 0.92,
  "timestamp": "2026-01-20T10:10:00Z"
}
```

## ImpressionRequest

```json
{
  "report_id": "r-123",
  "findings_text": "Im CT Thorax ...",
  "image_urls": ["https://example.local/images/series-1/frame-1.jpg"],
  "image_paths": ["/data/images/series-1/frame-1.jpg"]
}
```

## ImpressionResponse

```json
{
  "text": "Automatische Beurteilung (Entwurf): ...",
  "confidence": 0.88,
  "model": "medgemma-v2",
  "generated_at": "2026-01-20T10:11:00Z"
}
```

## QAResponse

```json
{
  "passes": true,
  "failures": [],
  "warnings": [
    "Fleischner-Kriterien fuer Rundherd pruefen."
  ],
  "quality_score": 78,
  "checks": [
    {
      "id": "qa-findings",
      "name": "Findings vorhanden",
      "status": "pass",
      "message": null
    }
  ]
}
```

## InferenceQueueRequest

```json
{
  "report_id": "r-123",
  "study_id": "st-123",
  "findings_text": "Im CT Thorax ...",
  "image_urls": ["https://example.local/images/series-1/frame-1.jpg"],
  "image_paths": ["/data/images/series-1/frame-1.jpg"],
  "requested_by": "system",
  "model_version": "medgemma-v2"
}
```

## InferenceQueueResponse

```json
{
  "job_id": "job-123",
  "status": "queued",
  "queued_at": "2026-01-20T10:08:10Z",
  "report_id": "r-123",
  "study_id": "st-123",
  "model_version": "medgemma-v2"
}
```

## InferenceStatusResponse

```json
{
  "job_id": "job-123",
  "status": "finished",
  "queued_at": "2026-01-20T10:08:10Z",
  "started_at": "2026-01-20T10:08:15Z",
  "ended_at": "2026-01-20T10:08:20Z",
  "result": {
    "summary": "Automatische Bildanalyse: ...",
    "confidence": 0.84,
    "model_version": "medgemma-v2",
    "completed_at": "2026-01-20T10:08:20Z"
  },
  "error": null
}
```

## AuditLogEntry (Response)

```json
{
  "id": "a-123",
  "event_type": "report_approved",
  "actor_id": "u-001",
  "study_id": "st-123",
  "report_id": "r-123",
  "timestamp": "2026-01-20T10:12:00Z",
  "metadata": {
    "qa_score": 85
  }
}
```

## WebSocket Event

```json
{
  "type": "report_status",
  "reportId": "r-123",
  "payload": {
    "asrStatus": "processing",
    "aiStatus": "processing",
    "qaStatus": "checking"
  },
  "timestamp": "2026-01-20T10:08:12Z"
}
```
