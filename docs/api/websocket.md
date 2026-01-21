# WebSocket (Live Updates)

## Ziel

Der WebSocket liefert Live-Events fuer:

- ASR Status (listening/processing)
- Inference Status (generating/error)
- QA Status (checking/pass/warn/fail)
- Report-Queue Updates
- Batch-Dashboard Statistiken

## Endpoint

`/api/v1/ws`

Der Server erwartet keine speziellen Client-Events; Nachrichten werden aktuell ignoriert.

## Event-Typen

### report_status

Status-Update für einen einzelnen Report:

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

### report_created (geplant)

Neuer Report in der Queue:

```json
{
  "type": "report_created",
  "reportId": "r-456",
  "payload": {
    "patientName": "Mustermann, Max",
    "studyDescription": "CT Thorax",
    "modality": "CT"
  },
  "timestamp": "2026-01-20T10:41:00Z"
}
```

### report_updated (geplant)

Report wurde geändert (Approval, Edit, etc.):

```json
{
  "type": "report_updated",
  "reportId": "r-123",
  "payload": {
    "status": "approved",
    "approvedBy": "Dr. Schmidt"
  },
  "timestamp": "2026-01-20T10:42:30Z"
}
```

## Client-Integration

### useWebSocket Hook

```typescript
const { isConnected, lastMessage, error } = useWebSocket('/api/v1/ws');
```

Features:
- Automatische Reconnects mit Exponential Backoff
- Connection-Status für UI-Feedback
- Typisierte Event-Handler

### useReportStatusSync Hook

```typescript
useReportStatusSync({
  onStatusUpdate: (reportId, status) => {
    // Update local state
  }
});
```

Features:
- Merged Live-Updates in bestehenden State
- Toast-Notifications bei QA-Events
- Debounced Updates für Performance

## UI-Indikatoren

- **LeftSidebar**: Wifi/WifiOff Icon zeigt Verbindungsstatus
- **Batch-Header**: Connection Badge mit Status
- **Toast**: Benachrichtigungen bei wichtigen Events

## Reconnect

Der Client implementiert automatische Reconnects:

1. Initial: Sofortige Verbindung
2. Bei Disconnect: 1s, 2s, 4s, 8s, 16s, 32s (max)
3. Bei Fokus: Sofortige Reconnect-Prüfung
