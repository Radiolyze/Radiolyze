import { useEffect, useRef, useCallback, useState } from 'react';
import { createWsClient } from '@/services/wsClient';
import type { AIStatus } from '@/types/radiology';

export interface ReportStatusPayload {
  asrStatus?: 'idle' | 'listening' | 'processing';
  aiStatus?: AIStatus;
  qaStatus?: 'pending' | 'checking' | 'pass' | 'warn' | 'fail';
  asrConfidence?: number;
}

export interface ReportStatusEvent {
  type: 'report_status';
  reportId: string;
  payload: ReportStatusPayload;
  timestamp: string;
}

type WsMessage = ReportStatusEvent;

// Module-level subscriber registry shared across the app's single WS connection.
type StatusListener = (payload: ReportStatusPayload) => void;
const reportStatusListeners = new Map<string, Set<StatusListener>>();

export function subscribeReportStatus(reportId: string, listener: StatusListener): () => void {
  if (!reportStatusListeners.has(reportId)) {
    reportStatusListeners.set(reportId, new Set());
  }
  reportStatusListeners.get(reportId)!.add(listener);
  return () => {
    reportStatusListeners.get(reportId)?.delete(listener);
  };
}

export function waitForReportStatus(
  reportId: string,
  isTerminal: (payload: ReportStatusPayload) => boolean,
  timeoutMs: number,
): Promise<ReportStatusPayload> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('WebSocket status wait timed out'));
    }, timeoutMs);

    const unsubscribe = subscribeReportStatus(reportId, (payload) => {
      if (isTerminal(payload)) {
        clearTimeout(timer);
        unsubscribe();
        resolve(payload);
      }
    });
  });
}

interface UseWebSocketOptions {
  onReportStatus?: (event: ReportStatusEvent) => void;
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onReportStatus, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<ReportStatusEvent | null>(null);
  const clientRef = useRef<ReturnType<typeof createWsClient> | null>(null);
  const callbackRef = useRef(onReportStatus);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onReportStatus;
  }, [onReportStatus]);

  const handleMessage = useCallback((data: unknown) => {
    const message = data as WsMessage;

    if (message.type === 'report_status') {
      setLastEvent(message);
      callbackRef.current?.(message);
      // Dispatch to module-level subscribers (used by waitForReportStatus)
      reportStatusListeners.get(message.reportId)?.forEach(fn => fn(message.payload));
    }
  }, []);

  const connect = useCallback(() => {
    if (clientRef.current) return;

    // The browser attaches the HttpOnly auth cookie to the WS handshake
    // automatically for same-origin requests (see issue #100) - no token
    // needs to be appended to the URL, which used to leak it into proxy/
    // access logs.
    const wsUrl = import.meta.env.VITE_WS_URL ||
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws`;

    clientRef.current = createWsClient({
      url: wsUrl,
      onMessage: handleMessage,
      onOpen: () => {
        console.log('[WS] Connected');
        setIsConnected(true);
      },
      onClose: () => {
        console.log('[WS] Disconnected');
        setIsConnected(false);
      },
      onError: (event) => {
        console.error('[WS] Error:', event);
      },
      onAuthFailure: () => {
        console.error('[WS] Authentication rejected, logging out');
        localStorage.removeItem('radiolyze-auth-token');
        setIsConnected(false);
        const loginPath = '/login';
        if (window.location.pathname !== loginPath) {
          window.location.href = loginPath;
        }
      },
    });

    clientRef.current.connect();
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    connect,
    disconnect,
  };
}

