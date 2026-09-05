# WebSocket (Live Updates)

## Purpose

The WebSocket delivers live events for:

- ASR status (idle/listening/processing)
- Inference status (queued/processing/error)
- QA status (pending/checking/pass/warn/fail)

## Endpoint

`/api/v1/ws`

Authentication uses the HttpOnly auth cookie, which the browser attaches to the
handshake automatically. A `?token=` query parameter is still accepted for
non-browser clients but is deprecated — it puts the credential into proxy and
access logs. Every use is logged as a warning, and a deployment whose clients
have migrated can reject it outright with `WS_ALLOW_QUERY_TOKEN=false`.

Apart from the heartbeat described below, the server ignores incoming messages.

## Heartbeat

An idle connection is pinged, and a connection that stops answering is closed.
Without this, a half-open socket is only noticed when a broadcast happens to
fail — and never at all on a connection nothing is broadcast to, so dead
connections accumulate on the server.

```json
{ "type": "ping" }
{ "type": "pong" }
```

- After `WS_HEARTBEAT_INTERVAL_SECONDS` (default `30`) without a message from
  the client, the server sends `{"type": "ping"}`. A client is expected to
  answer `{"type": "pong"}` — any message counts as a sign of life, `pong` is
  just the cheapest one.
- After `WS_IDLE_TIMEOUT_SECONDS` (default `120`) without a message, the server
  closes with code **4408** (`Idle timeout`). This is a normal, retryable
  disconnect — clients should reconnect, unlike on the auth codes 1008/4401.
- A client-sent `{"type": "ping"}` is answered with `{"type": "pong"}`, so
  either side can drive the exchange.
- Setting either variable to `0` disables that half.

These are application-level frames rather than protocol-level ping/pong: the
latter are answered by the ASGI server itself and never reach the application,
so they prove the socket is open but not that anything above it is alive.

The frontend `wsClient` answers pings automatically and does not pass heartbeat
frames to `onMessage`.

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
    "qaStatus": "checking",
    "status": "draft"
  },
  "timestamp": "2026-01-20T10:40:12Z"
}
```

Every field is optional; a payload only carries what changed.

`status` is the lifecycle status of the report itself (`pending`, `in_progress`,
`draft`, `finalized`), as opposed to the status of a single sub-task. It is sent
by `POST /api/v1/reports/{id}/finalize`, by `PATCH /api/v1/reports/{id}`, and by
the inference worker on the transition to `draft`. Clients that render a report
status — the queue badge, the approve button — need it to follow a change made
in another session; without it they keep showing the state from their last fetch.

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
