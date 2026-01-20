type MessageHandler = (data: unknown) => void;

interface WsClientOptions {
  url: string;
  onMessage?: MessageHandler;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  reconnectIntervalMs?: number;
}

export function createWsClient(options: WsClientOptions) {
  const {
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectIntervalMs = 3000,
  } = options;

  let socket: WebSocket | null = null;
  let shouldReconnect = true;

  const connect = () => {
    socket = new WebSocket(url);

    socket.addEventListener('open', () => onOpen?.());
    socket.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage?.(parsed);
      } catch {
        onMessage?.(event.data);
      }
    });
    socket.addEventListener('close', () => {
      onClose?.();
      if (shouldReconnect) {
        setTimeout(connect, reconnectIntervalMs);
      }
    });
    socket.addEventListener('error', (event) => onError?.(event));
  };

  const disconnect = () => {
    shouldReconnect = false;
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
