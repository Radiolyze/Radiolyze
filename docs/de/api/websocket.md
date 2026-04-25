# WebSocket (Live Updates)

## Ziel

Der WebSocket liefert Live-Events fuer:

- ASR Status (idle/listening/processing)
- Inference Status (queued/processing/error)
- QA Status (pending/checking/pass/warn/fail)

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
    "aiStatus": "processing",
    "qaStatus": "checking"
  },
  "timestamp": "2026-01-20T10:40:12Z"
}
```

## Client-Integration

### useWebSocket Hook

```typescript
const { isConnected, lastEvent } = useWebSocket({
  onReportStatus: (event) => {
    // Update local state
  },
});
```

Features:
- Automatische Reconnects (Fixed Interval)
- Connection-Status fuer UI-Feedback
- Typisierte Event-Handler

### useReportStatusSync Hook

```typescript
const { isConnected, getEnhancedItems, getReportStatus } = useReportStatusSync(queueItems);
```

Features:
- Merged Live-Updates in bestehenden State
- Toast-Notifications bei QA-Events

## UI-Indikatoren

- **LeftSidebar**: Wifi/WifiOff Icon zeigt Verbindungsstatus
- **Batch-Header**: Connection Badge mit Status
- **Toast**: Benachrichtigungen bei wichtigen Events

## Reconnect

Der Client implementiert automatische Reconnects:

1. Initial: Sofortige Verbindung
2. Bei Disconnect: 1s, 2s, 4s, 8s, 16s, 32s (max)
3. Bei Fokus: Sofortige Reconnect-Prüfung
