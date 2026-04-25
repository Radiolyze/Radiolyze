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
    }
  }, []);

  const connect = useCallback(() => {
    if (clientRef.current) return;

    const authToken = localStorage.getItem('radiolyze-auth-token');
    const baseWsUrl = import.meta.env.VITE_WS_URL ||
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws`;
    const wsUrl = authToken ? `${baseWsUrl}?token=${encodeURIComponent(authToken)}` : baseWsUrl;

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
      reconnectIntervalMs: 3000,
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

