import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

interface UseAutoSaveOptions {
  /** Debounce interval in milliseconds (default: 1500) */
  debounceMs?: number;
  /** Callback that performs the actual save */
  onSave: (value: string) => Promise<void>;
}

/**
 * Auto-save hook with debouncing and status tracking.
 *
 * Tracks dirty state and debounces save calls to avoid excessive API requests
 * when the user types continuously. Reports save status for UI indicators.
 */
export function useAutoSave({ debounceMs = 1500, onSave }: UseAutoSaveOptions) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');
  const pendingRef = useRef<string | null>(null);

  const save = useCallback(
    async (value: string) => {
      // Skip if content hasn't changed since last save
      if (value === lastSavedRef.current) {
        return;
      }

      setStatus('saving');
      try {
        await onSave(value);
        lastSavedRef.current = value;
        setStatus('saved');
      } catch (err: unknown) {
        if (err instanceof Error && err.message?.includes('409')) {
          setStatus('conflict');
        } else {
          setStatus('error');
        }
      }
    },
    [onSave],
  );

  const debouncedSave = useCallback(
    (value: string) => {
      pendingRef.current = value;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        if (pendingRef.current !== null) {
          save(pendingRef.current);
          pendingRef.current = null;
        }
      }, debounceMs);
    },
    [debounceMs, save],
  );

  /** Flush any pending save immediately (e.g., before navigation). */
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current !== null) {
      save(pendingRef.current);
      pendingRef.current = null;
    }
  }, [save]);

  /** Reset the last-saved reference (e.g., when loading a new report). */
  const reset = useCallback((initialValue: string) => {
    lastSavedRef.current = initialValue;
    pendingRef.current = null;
    setStatus('idle');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { status, debouncedSave, flush, reset };
}
