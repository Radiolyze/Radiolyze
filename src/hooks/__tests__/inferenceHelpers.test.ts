import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { awaitInferenceResult, pollInferenceResult } from '../reporting/inferenceHelpers';

// --- Mocks ---

const getStatusMock = vi.fn();
vi.mock('@/services/inferenceClient', () => ({
  inferenceClient: { getStatus: (...args: unknown[]) => getStatusMock(...args) },
}));

// waitForReportStatus is mocked so we can control when it resolves/rejects
// without needing a real WS connection.
let waitForReportStatusImpl: (
  reportId: string,
  isTerminal: (p: { aiStatus?: string }) => boolean,
  timeoutMs: number,
) => Promise<{ aiStatus?: string }>;

vi.mock('@/hooks/useWebSocket', () => ({
  waitForReportStatus: (
    reportId: string,
    isTerminal: (p: { aiStatus?: string }) => boolean,
    timeoutMs: number,
  ) => waitForReportStatusImpl(reportId, isTerminal, timeoutMs),
}));

// --- Helpers ---

const makeGetStatusResponse = (status: string, result?: unknown, error?: string) => ({
  status,
  result,
  error,
});

describe('pollInferenceResult', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getStatusMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result when status is "finished"', async () => {
    getStatusMock.mockResolvedValue(makeGetStatusResponse('finished', { summary: 'All clear' }));

    const promise = pollInferenceResult('job-1');
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ summary: 'All clear' });
  });

  it('throws when status is "failed"', async () => {
    getStatusMock.mockResolvedValue(makeGetStatusResponse('failed', null, 'Model error'));

    const promise = pollInferenceResult('job-err');
    // Attach rejection handler before running timers to avoid unhandled rejection
    const assertion = expect(promise).rejects.toThrow('Model error');
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('calls onStatus callback on status transitions', async () => {
    const onStatus = vi.fn();
    getStatusMock
      .mockResolvedValueOnce(makeGetStatusResponse('queued'))
      .mockResolvedValueOnce(makeGetStatusResponse('started'))
      .mockResolvedValue(makeGetStatusResponse('finished', { summary: 'done' }));

    const promise = pollInferenceResult('job-status', onStatus);
    await vi.runAllTimersAsync();
    await promise;

    expect(onStatus).toHaveBeenCalledWith('queued');
    expect(onStatus).toHaveBeenCalledWith('processing');
  });
});

describe('awaitInferenceResult', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getStatusMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to polling when reportId is undefined', async () => {
    getStatusMock.mockResolvedValue(makeGetStatusResponse('finished', { summary: 'poll-result' }));

    const promise = awaitInferenceResult('job-noid', undefined);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ summary: 'poll-result' });
    expect(getStatusMock).toHaveBeenCalled();
  });

  it('resolves via WS path when terminal status arrives', async () => {
    waitForReportStatusImpl = async () => ({ aiStatus: 'idle' });
    getStatusMock.mockResolvedValue(makeGetStatusResponse('finished', { summary: 'ws-result' }));

    const result = await awaitInferenceResult('job-ws', 'rep-ws');

    expect(result).toEqual({ summary: 'ws-result' });
    // getStatus called exactly once (single fetch after WS signal)
    expect(getStatusMock).toHaveBeenCalledOnce();
  });

  it('throws when WS signals aiStatus "error"', async () => {
    waitForReportStatusImpl = async () => ({ aiStatus: 'error' });

    await expect(awaitInferenceResult('job-err', 'rep-err')).rejects.toThrow('Inference failed');
    // No getStatus call on error path
    expect(getStatusMock).not.toHaveBeenCalled();
  });

  it('falls back to polling when WS does not signal within 4 seconds', async () => {
    // WS never resolves within the fallback window
    waitForReportStatusImpl = (_id, _isTerminal, timeoutMs) =>
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs));

    getStatusMock.mockResolvedValue(makeGetStatusResponse('finished', { summary: 'fallback' }));

    const promise = awaitInferenceResult('job-fallback', 'rep-fallback');

    // Advance past the 4-second fallback delay
    await vi.advanceTimersByTimeAsync(4_001);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ summary: 'fallback' });
  });
});
