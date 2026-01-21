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
  ]
}
```

## ReportFinalizeRequest

```json
{
  "approvedBy": "Dr. Radiologe",
  "signature": "Dr. Radiologe"
}
```

## ASRResponse

```json
{
  "text": "Im CT Thorax mit Kontrastmittel ...",
  "confidence": 0.92,
  "timestamp": "2026-01-20T10:10:00Z"
}
```

## ImpressionResponse

```json
{
  "text": "Automatische Beurteilung (Entwurf): ...",
  "confidence": 0.88,
  "model": "mock-impression-v1",
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

## AuditLogEntry (Response)

```json
{
  "id": "a-123",
  "event_type": "report_finalized",
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
    "aiStatus": "generating",
    "qaStatus": "checking"
  },
  "timestamp": "2026-01-20T10:08:12Z"
}
```
