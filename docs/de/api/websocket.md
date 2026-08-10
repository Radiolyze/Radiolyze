# WebSocket (Live Updates)

## Ziel

Der WebSocket liefert Live-Events fuer:

- ASR Status (idle/listening/processing)
- Inference Status (queued/processing/error)
- QA Status (pending/checking/pass/warn/fail)

## Endpoint

`/api/v1/ws`

Die Authentifizierung läuft über das HttpOnly-Auth-Cookie, das der Browser beim
Handshake automatisch mitschickt. Ein `?token=`-Query-Parameter wird für
Nicht-Browser-Clients weiterhin akzeptiert, ist aber deprecated — er schreibt
das Credential in Proxy- und Access-Logs. Jede Nutzung wird als Warning
protokolliert; ein Deployment, dessen Clients migriert sind, kann ihn mit
`WS_ALLOW_QUERY_TOKEN=false` ganz ablehnen.

Abgesehen vom unten beschriebenen Heartbeat ignoriert der Server eingehende
Nachrichten.

## Heartbeat

Eine untätige Verbindung wird angepingt, eine Verbindung ohne Antwort
geschlossen. Ohne das fällt ein halb-offener Socket erst auf, wenn zufällig ein
Broadcast fehlschlägt — und auf einer Verbindung ohne Broadcasts nie, sodass
tote Verbindungen sich auf dem Server ansammeln.

```json
{ "type": "ping" }
{ "type": "pong" }
```

- Nach `WS_HEARTBEAT_INTERVAL_SECONDS` (Default `30`) ohne Nachricht vom Client
  sendet der Server `{"type": "ping"}`. Der Client antwortet mit
  `{"type": "pong"}` — jede Nachricht gilt als Lebenszeichen, `pong` ist nur die
  günstigste.
- Nach `WS_IDLE_TIMEOUT_SECONDS` (Default `120`) ohne Nachricht schließt der
  Server mit Code **4408** (`Idle timeout`). Das ist ein normaler, wiederhol­barer
  Disconnect — Clients sollen reconnecten, anders als bei den Auth-Codes
  1008/4401.
- Ein vom Client gesendetes `{"type": "ping"}` wird mit `{"type": "pong"}`
  beantwortet, sodass beide Seiten den Austausch treiben können.
- Der Wert `0` deaktiviert die jeweilige Hälfte.

Es sind bewusst Application-Level-Frames statt Protocol-Level-Ping/Pong: letztere
beantwortet der ASGI-Server selbst, sie erreichen die Anwendung nie und belegen
damit nur, dass der Socket offen ist — nicht, dass darüber noch etwas lebt.

Der Frontend-`wsClient` beantwortet Pings automatisch und reicht Heartbeat-Frames
nicht an `onMessage` weiter.

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
