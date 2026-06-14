import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket, subscribeReportStatus, waitForReportStatus } from '../useWebSocket';

// Captures the callbacks passed to createWsClient so tests can trigger them.
let capturedOnMessage: ((data: unknown) => void) | undefined;
let capturedOnOpen: (() => void) | undefined;
let capturedOnClose: (() => void) | undefined;

vi.mock('@/services/wsClient', () => ({
  createWsClient: vi.fn((opts: {
    onMessage?: (data: unknown) => void;
    onOpen?: () => void;
    onClose?: () => void;
  }) => {
    capturedOnMessage = opts.onMessage;
    capturedOnOpen = opts.onOpen;
    capturedOnClose = opts.onClose;
    return {
      connect: vi.fn(() => capturedOnOpen?.()),
      disconnect: vi.fn(() => capturedOnClose?.()),
      send: vi.fn(),
    };
  }),
}));

const sendWsMessage = (reportId: string, payload: Record<string, unknown>) => {
  capturedOnMessage?.({
    type: 'report_status',
    reportId,
    payload,
    timestamp: new Date().toISOString(),
  });
};

describe('useWebSocket', () => {
  beforeEach(() => {
    capturedOnMessage = undefined;
    capturedOnOpen = undefined;
    capturedOnClose = undefined;
    localStorage.clear();
  });

  it('connects on mount when autoConnect is true', () => {
    const { result } = renderHook(() => useWebSocket());
    // connect() is called → mock fires onOpen → isConnected = true
    expect(result.current.isConnected).toBe(true);
  });

  it('sets isConnected to false on close', () => {
    const { result } = renderHook(() => useWebSocket());
    expect(result.current.isConnected).toBe(true);
    act(() => capturedOnClose?.());
    expect(result.current.isConnected).toBe(false);
  });

  it('does not connect when autoConnect is false', () => {
    const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
    expect(result.current.isConnected).toBe(false);
  });

  it('delivers report_status events to onReportStatus callback', () => {
    const onReportStatus = vi.fn();
    renderHook(() => useWebSocket({ onReportStatus }));

    act(() => sendWsMessage('report-1', { aiStatus: 'processing' }));

    expect(onReportStatus).toHaveBeenCalledOnce();
    expect(onReportStatus).toHaveBeenCalledWith(
      expect.objectContaining({ reportId: 'report-1', payload: { aiStatus: 'processing' } }),
    );
  });

  it('updates lastEvent on incoming report_status', () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => sendWsMessage('report-2', { aiStatus: 'idle' }));

    expect(result.current.lastEvent).toMatchObject({
      type: 'report_status',
      reportId: 'report-2',
      payload: { aiStatus: 'idle' },
    });
  });
});

describe('subscribeReportStatus', () => {
  beforeEach(() => {
    capturedOnMessage = undefined;
    localStorage.clear();
  });

  it('receives payloads dispatched via the WS hook', () => {
    const received: unknown[] = [];
    const unsubscribe = subscribeReportStatus('r-42', (p) => received.push(p));

    // Mount hook so messages are dispatched
    renderHook(() => useWebSocket());
    act(() => sendWsMessage('r-42', { aiStatus: 'processing' }));
    act(() => sendWsMessage('r-42', { aiStatus: 'idle' }));

    expect(received).toEqual([{ aiStatus: 'processing' }, { aiStatus: 'idle' }]);
    unsubscribe();
  });

  it('does not receive messages for a different reportId', () => {
    const received: unknown[] = [];
    const unsubscribe = subscribeReportStatus('r-A', (p) => received.push(p));

    renderHook(() => useWebSocket());
    act(() => sendWsMessage('r-B', { aiStatus: 'idle' }));

    expect(received).toHaveLength(0);
    unsubscribe();
  });

  it('stops receiving after unsubscribe', () => {
    const received: unknown[] = [];
    const unsubscribe = subscribeReportStatus('r-99', (p) => received.push(p));

    renderHook(() => useWebSocket());
    act(() => sendWsMessage('r-99', { aiStatus: 'processing' }));
    unsubscribe();
    act(() => sendWsMessage('r-99', { aiStatus: 'idle' }));

    expect(received).toHaveLength(1);
  });
});

describe('waitForReportStatus', () => {
  beforeEach(() => {
    capturedOnMessage = undefined;
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when terminal condition is met', async () => {
    renderHook(() => useWebSocket());

    const promise = waitForReportStatus(
      'r-terminal',
      (p) => p.aiStatus === 'idle' || p.aiStatus === 'error',
      5_000,
    );

    act(() => sendWsMessage('r-terminal', { aiStatus: 'idle' }));

    await expect(promise).resolves.toEqual({ aiStatus: 'idle' });
  });

  it('ignores non-terminal payloads', async () => {
    renderHook(() => useWebSocket());

    const promise = waitForReportStatus(
      'r-multi',
      (p) => p.aiStatus === 'idle',
      5_000,
    );

    act(() => sendWsMessage('r-multi', { aiStatus: 'processing' }));
    act(() => sendWsMessage('r-multi', { aiStatus: 'idle' }));

    await expect(promise).resolves.toEqual({ aiStatus: 'idle' });
  });

  it('rejects after timeout', async () => {
    vi.useFakeTimers();

    const promise = waitForReportStatus('r-timeout', () => false, 1_000);

    vi.advanceTimersByTime(1_001);

    await expect(promise).rejects.toThrow('WebSocket status wait timed out');
  });
});
