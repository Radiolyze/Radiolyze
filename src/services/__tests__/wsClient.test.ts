import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWsClient } from '../wsClient';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  url: string;
  readyState = 0;
  listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    (this.listeners[type] ??= []).push(handler);
  }

  emit(type: string, event: unknown = {}) {
    this.listeners[type]?.forEach((handler) => handler(event));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit('close', { code: 1000, wasClean: true });
  }

  send = vi.fn();
}

describe('createWsClient reconnect backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    // @ts-expect-error test double for the global WebSocket
    global.WebSocket = FakeWebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconnects with increasing delay after repeated failures, capped at max', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1); // no jitter shrinkage
    const client = createWsClient({
      url: 'ws://test',
      reconnectIntervalMs: 1000,
      maxReconnectIntervalMs: 8000,
    });

    client.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);

    // 1st failure -> delay = 1000 * 2^0 = 1000ms
    FakeWebSocket.instances[0].emit('close', { code: 1006, wasClean: false });
    vi.advanceTimersByTime(999);
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);

    // 2nd failure -> delay = 1000 * 2^1 = 2000ms
    FakeWebSocket.instances[1].emit('close', { code: 1006, wasClean: false });
    vi.advanceTimersByTime(1999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(3);

    // 3rd failure -> delay = 1000 * 2^2 = 4000ms
    FakeWebSocket.instances[2].emit('close', { code: 1006, wasClean: false });
    vi.advanceTimersByTime(4000);
    expect(FakeWebSocket.instances).toHaveLength(4);

    // 4th failure -> exponential would be 8000ms, still within cap of 8000ms
    FakeWebSocket.instances[3].emit('close', { code: 1006, wasClean: false });
    vi.advanceTimersByTime(8000);
    expect(FakeWebSocket.instances).toHaveLength(5);

    // 5th failure -> exponential would be 16000ms, capped at 8000ms
    FakeWebSocket.instances[4].emit('close', { code: 1006, wasClean: false });
    vi.advanceTimersByTime(7999);
    expect(FakeWebSocket.instances).toHaveLength(5);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(6);

    randomSpy.mockRestore();
  });

  it('resets the backoff counter after a successful open', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1);
    const client = createWsClient({
      url: 'ws://test',
      reconnectIntervalMs: 1000,
      maxReconnectIntervalMs: 8000,
    });

    client.connect();
    FakeWebSocket.instances[0].emit('close', { code: 1006, wasClean: false }); // attempt -> delay 1000ms
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);

    FakeWebSocket.instances[1].emit('close', { code: 1006, wasClean: false }); // attempt -> delay 2000ms
    vi.advanceTimersByTime(2000);
    expect(FakeWebSocket.instances).toHaveLength(3);

    // Connection succeeds, so backoff should reset back to the base interval.
    FakeWebSocket.instances[2].emit('open');
    FakeWebSocket.instances[2].emit('close', { code: 1006, wasClean: false });
    vi.advanceTimersByTime(999);
    expect(FakeWebSocket.instances).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(4);

    randomSpy.mockRestore();
  });

  it('applies jitter within the 50%-100% band of the capped delay', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const client = createWsClient({
      url: 'ws://test',
      reconnectIntervalMs: 1000,
      maxReconnectIntervalMs: 8000,
    });

    client.connect();
    FakeWebSocket.instances[0].emit('close', { code: 1006, wasClean: false });

    // random() === 0 -> jitter factor 0.5 -> delay = 500ms
    vi.advanceTimersByTime(499);
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);

    randomSpy.mockRestore();
  });

  it('stops reconnecting after maxReconnectAttempts is reached', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const client = createWsClient({
      url: 'ws://test',
      reconnectIntervalMs: 10,
      maxReconnectIntervalMs: 100,
      maxReconnectAttempts: 2,
    });

    client.connect();
    FakeWebSocket.instances[0].emit('close', { code: 1006, wasClean: false });
    vi.advanceTimersByTime(10);
    expect(FakeWebSocket.instances).toHaveLength(2);

    FakeWebSocket.instances[1].emit('close', { code: 1006, wasClean: false });
    vi.advanceTimersByTime(20);
    expect(FakeWebSocket.instances).toHaveLength(3);

    FakeWebSocket.instances[2].emit('close', { code: 1006, wasClean: false });
    vi.advanceTimersByTime(10_000);
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it('does not reconnect after an explicit disconnect', () => {
    const client = createWsClient({ url: 'ws://test', reconnectIntervalMs: 10 });
    client.connect();
    client.disconnect();
    vi.advanceTimersByTime(10_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('treats auth-failure close codes as terminal and notifies via onAuthFailure', () => {
    const onAuthFailure = vi.fn();
    const client = createWsClient({
      url: 'ws://test',
      reconnectIntervalMs: 10,
      onAuthFailure,
    });

    client.connect();
    FakeWebSocket.instances[0].emit('close', { code: 4401, wasClean: false });
    vi.advanceTimersByTime(10_000);

    expect(onAuthFailure).toHaveBeenCalledOnce();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('treats close code 1008 (policy violation) as an auth failure', () => {
    const onAuthFailure = vi.fn();
    const client = createWsClient({
      url: 'ws://test',
      reconnectIntervalMs: 10,
      onAuthFailure,
    });

    client.connect();
    FakeWebSocket.instances[0].emit('close', { code: 1008, wasClean: false });
    vi.advanceTimersByTime(10_000);

    expect(onAuthFailure).toHaveBeenCalledOnce();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
