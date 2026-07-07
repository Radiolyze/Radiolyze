import { logger } from "@/lib/logger";

type MessageHandler = (data: unknown) => void;

// Close codes that indicate the server rejected authentication — reconnecting
// would just repeat the same rejection, so treat these as terminal.
const AUTH_FAILURE_CLOSE_CODES = new Set([1008, 4401]);

interface WsClientOptions {
  url: string;
  onMessage?: MessageHandler;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onAuthFailure?: () => void;
  /** Base delay for the first reconnect attempt, in ms. */
  reconnectIntervalMs?: number;
  /** Upper bound the exponential backoff will not exceed, in ms. */
  maxReconnectIntervalMs?: number;
  /** Stop reconnecting after this many consecutive failed attempts. Unlimited if omitted. */
  maxReconnectAttempts?: number;
}

export function createWsClient(options: WsClientOptions) {
  const {
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    onAuthFailure,
    reconnectIntervalMs = 1000,
    maxReconnectIntervalMs = 30000,
    maxReconnectAttempts,
  } = options;

  let socket: WebSocket | null = null;
  let shouldReconnect = true;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const nextReconnectDelay = () => {
    const exponential = reconnectIntervalMs * 2 ** reconnectAttempts;
    const capped = Math.min(exponential, maxReconnectIntervalMs);
    // Full jitter: pick uniformly between 50% and 100% of the capped delay,
    // so many clients reconnecting at once don't all retry in lockstep.
    return capped * (0.5 + Math.random() * 0.5);
  };

  const scheduleReconnect = () => {
    if (maxReconnectAttempts !== undefined && reconnectAttempts >= maxReconnectAttempts) {
      return;
    }
    const delay = nextReconnectDelay();
    reconnectAttempts += 1;
    reconnectTimer = setTimeout(connect, delay);
  };

  const connect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      reconnectAttempts = 0;
      onOpen?.();
    });
    socket.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage?.(parsed);
      } catch (err) {
        // Non-JSON payload; pass the raw data through as-is.
        logger.debug("[wsClient] Received non-JSON message, passing through raw", err);
        onMessage?.(event.data);
      }
    });
    socket.addEventListener("close", (event) => {
      onClose?.(event);
      if (!shouldReconnect) {
        return;
      }
      if (AUTH_FAILURE_CLOSE_CODES.has(event.code)) {
        shouldReconnect = false;
        onAuthFailure?.();
        return;
      }
      scheduleReconnect();
    });
    socket.addEventListener("error", (event) => onError?.(event));
  };

  const disconnect = () => {
    shouldReconnect = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    socket?.close();
  };

  const send = (payload: unknown) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(payload));
  };

  return { connect, disconnect, send };
}
