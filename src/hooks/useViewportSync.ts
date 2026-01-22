import { useCallback, useEffect, useRef } from 'react';
import type { SyncOptions, ViewportState } from '@/types/viewerSync';

type SyncHandler = (state: Partial<ViewportState>) => void;

export const useViewportSync = (syncOptions: SyncOptions) => {
  const debounceRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    },
    []
  );

  return useCallback(
    (state: Partial<ViewportState>, onSync: SyncHandler) => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }

      debounceRef.current = window.setTimeout(() => {
        const syncState: Partial<ViewportState> = {};
        if (syncOptions.zoom && state.zoom !== undefined) {
          syncState.zoom = state.zoom;
        }
        if (syncOptions.pan && state.pan !== undefined) {
          syncState.pan = state.pan;
        }
        if (syncOptions.windowLevel && state.windowLevel !== undefined) {
          syncState.windowLevel = state.windowLevel;
        }
        if (Object.keys(syncState).length > 0) {
          onSync(syncState);
        }
      }, 16);
    },
    [syncOptions]
  );
};
