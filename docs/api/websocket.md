# WebSocket (Live Updates)

## Ziel

Der WebSocket liefert Live-Events fuer:

- ASR Status (listening/processing)
- Inference Status (generating/error)
- QA Status (checking/pass/warn/fail)

## Beispiel-Event

```json
{
  "type": "report_status",
  "reportId": "r-123",
  "payload": {
    "asrStatus": "processing",
    "aiStatus": "generating",
    "qaStatus": "checking"
  },
  "timestamp": "2026-01-20T10:40:12Z"
}
```

## Reconnect

Der Client sollte automatische Reconnects mit Backoff nutzen.
