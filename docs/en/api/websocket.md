# WebSocket (Live Updates)

## Purpose

The WebSocket delivers live events for:

- ASR status (idle/listening/processing)
- Inference status (queued/processing/error)
- QA status (pending/checking/pass/warn/fail)

## Endpoint

`/api/v1/ws`

The server does not expect any specific client events; incoming messages are currently ignored.

## Event Types

### report_status

Status update for an individual report:

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

## Client Integration

### useWebSocket Hook

```typescript
const { isConnected, lastEvent } = useWebSocket({
  onReportStatus: (event) => {
    // Update local state
  },
});
```

Features:
- Automatic reconnects (fixed interval)
- Connection status for UI feedback
- Typed event handlers

### useReportStatusSync Hook

```typescript
const { isConnected, getEnhancedItems, getReportStatus } = useReportStatusSync(queueItems);
```

Features:
- Merges live updates into existing state
- Toast notifications on QA events

## UI Indicators

- **LeftSidebar**: Wifi/WifiOff icon shows connection status
- **Batch header**: Connection badge with status
- **Toast**: Notifications for important events

## Reconnect

The client implements automatic reconnects:

1. Initial: immediate connection
2. On disconnect: 1s, 2s, 4s, 8s, 16s, 32s (max)
3. On focus: immediate reconnect check
