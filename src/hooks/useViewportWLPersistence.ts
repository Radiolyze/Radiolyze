import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { StackViewport } from '@cornerstonejs/core';
import type { ViewportState } from '@/types/viewerSync';
import { useUserPreferences } from '@/hooks/useUserPreferences';

interface UseViewportWLPersistenceOptions {
  stackViewportRef: MutableRefObject<StackViewport | null>;
  syncingRef: MutableRefObject<boolean>;
  /** True once the stack is loaded and the default preset has been applied. */
  ready: boolean;
  seriesId: string | null;
}

const PERSIST_DEBOUNCE_MS = 300;

/**
 * Persists the viewer's VOI/window-level to localStorage (via user preferences)
 * and restores it when a series is loaded.
 *
 * Writing is debounced so dragging the window-level tool does not thrash
 * localStorage. Restoring runs once per series, after the stack is ready, so a
 * stored value overrides the default preset on load. Later explicit preset
 * selection still wins because that re-applies on `selectedPresetId` change.
 */
export const useViewportWLPersistence = ({
  stackViewportRef,
  syncingRef,
  ready,
  seriesId,
}: UseViewportWLPersistenceOptions) => {
  const { preferences, setPreference } = useUserPreferences();
  const debounceRef = useRef<number | null>(null);
  const appliedSeriesRef = useRef<string | null>(null);

  const viewportWL = preferences.viewportWL;
  // Keep latest persisted value accessible inside the restore effect without
  // making it a dependency (avoids re-applying when the user adjusts WL).
  const viewportWLRef = useRef(viewportWL);
  useEffect(() => {
    viewportWLRef.current = viewportWL;
  }, [viewportWL]);

  useEffect(
    () => () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    },
    []
  );

  const persistWindowLevel = useCallback(
    (windowLevel: ViewportState['windowLevel']) => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        setPreference('viewportWL', { width: windowLevel.width, center: windowLevel.center });
      }, PERSIST_DEBOUNCE_MS);
    },
    [setPreference]
  );

  // Restore once per series, after the stack is ready.
  useEffect(() => {
    if (!ready || !seriesId) {
      return;
    }
    if (appliedSeriesRef.current === seriesId) {
      return;
    }
    appliedSeriesRef.current = seriesId;

    const stored = viewportWLRef.current;
    const viewport = stackViewportRef.current;
    if (!stored || !viewport || !viewport.getCurrentImageId?.()) {
      return;
    }

    syncingRef.current = true;
    try {
      const halfWidth = stored.width / 2;
      viewport.setProperties({
        voiRange: {
          lower: stored.center - halfWidth,
          upper: stored.center + halfWidth,
        },
      });
      viewport.render();
    } catch {
      // Image data not yet loaded — skip restore.
    } finally {
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    }
  }, [ready, seriesId, stackViewportRef, syncingRef]);

  return { persistWindowLevel };
};
