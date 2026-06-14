import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReportStatusSync } from '../useReportStatusSync';

// Capture the onReportStatus callback injected by useReportStatusSync
let capturedOnReportStatus: ((event: unknown) => void) | undefined;
let capturedOnMessage: ((data: unknown) => void) | undefined;

vi.mock('@/services/wsClient', () => ({
  createWsClient: vi.fn((opts: {
    onMessage?: (data: unknown) => void;
    onOpen?: () => void;
  }) => {
    capturedOnMessage = opts.onMessage;
    opts.onOpen?.();
    return { connect: vi.fn(), disconnect: vi.fn(), send: vi.fn() };
  }),
}));

// Toast spy — mock the module so we can assert calls without a real DOM
const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

const fireWsMessage = (reportId: string, payload: Record<string, unknown>) => {
  capturedOnMessage?.({
    type: 'report_status',
    reportId,
    payload,
    timestamp: new Date().toISOString(),
  });
};

describe('useReportStatusSync', () => {
  beforeEach(() => {
    capturedOnReportStatus = undefined;
    capturedOnMessage = undefined;
    toastMock.mockClear();
    localStorage.clear();
  });

  it('statusMap is empty initially', () => {
    const { result } = renderHook(() => useReportStatusSync());
    expect(result.current.statusMap).toEqual({});
  });

  it('updates statusMap when a report_status event arrives', () => {
    const { result } = renderHook(() => useReportStatusSync());

    act(() => fireWsMessage('rep-1', { aiStatus: 'processing' }));

    expect(result.current.statusMap['rep-1']).toMatchObject({ aiStatus: 'processing' });
  });

  it('merges multiple payloads for the same report', () => {
    const { result } = renderHook(() => useReportStatusSync());

    act(() => fireWsMessage('rep-2', { aiStatus: 'processing' }));
    act(() => fireWsMessage('rep-2', { qaStatus: 'checking' }));

    expect(result.current.statusMap['rep-2']).toMatchObject({
      aiStatus: 'processing',
      qaStatus: 'checking',
    });
  });

  it('shows a destructive toast when qaStatus is "fail"', () => {
    renderHook(() => useReportStatusSync());

    act(() => fireWsMessage('rep-3', { qaStatus: 'fail' }));

    expect(toastMock).toHaveBeenCalledOnce();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    );
  });

  it('shows a success toast when qaStatus is "pass"', () => {
    renderHook(() => useReportStatusSync());

    act(() => fireWsMessage('rep-4', { qaStatus: 'pass' }));

    expect(toastMock).toHaveBeenCalledOnce();
    expect(toastMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ variant: 'destructive' }),
    );
  });

  it('getEnhancedItems overlays live status onto queue items', () => {
    const { result } = renderHook(() => useReportStatusSync());

    act(() => fireWsMessage('rep-5', { aiStatus: 'idle', qaStatus: 'pass' }));

    const items = [
      { report: { id: 'rep-5', aiStatus: 'queued', qaStatus: 'pending' } },
    ] as Parameters<typeof result.current.getEnhancedItems>[0];

    const enhanced = result.current.getEnhancedItems(items);
    expect(enhanced[0].report).toMatchObject({ aiStatus: 'idle', qaStatus: 'pass' });
  });

  it('getEnhancedItems is a no-op for reports without live status', () => {
    const { result } = renderHook(() => useReportStatusSync());

    const items = [
      { report: { id: 'rep-unknown', aiStatus: 'queued' } },
    ] as Parameters<typeof result.current.getEnhancedItems>[0];

    const enhanced = result.current.getEnhancedItems(items);
    expect(enhanced[0].report.aiStatus).toBe('queued');
  });
});
