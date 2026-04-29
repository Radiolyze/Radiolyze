import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'radiolyze:mesh:label-colors';

type RGB = [number, number, number];
type ColorMap = Record<string, RGB>;

function readStored(): ColorMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as ColorMap;
    }
  } catch {
    /* corrupt JSON; fall through to empty map */
  }
  return {};
}

function persist(map: ColorMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage full or unavailable */
  }
}

export interface UseLabelColorsResult {
  /** Returns a stored override or `undefined` if the user hasn't customized this label. */
  getOverride: (name: string) => RGB | undefined;
  /** Persists an RGB triple (each channel in 0..1) for `name`. */
  override: (name: string, rgb: RGB) => void;
  /** Drops the override for a single label so it falls back to the manifest color. */
  reset: (name: string) => void;
  /** Drops every override (e.g. for a "reset all" button). */
  resetAll: () => void;
}

/**
 * Per-label color overrides backed by `localStorage`. Keyed by label *name*
 * (not id) so that customizing "spleen" once carries over between studies and
 * across re-runs of the same job.
 */
export function useLabelColors(): UseLabelColorsResult {
  const [map, setMap] = useState<ColorMap>(() => readStored());

  // Re-hydrate on storage changes from other tabs.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setMap(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const getOverride = useCallback(
    (name: string): RGB | undefined => {
      const value = map[name];
      if (!value || !Array.isArray(value) || value.length !== 3) return undefined;
      return [value[0], value[1], value[2]];
    },
    [map],
  );

  const override = useCallback((name: string, rgb: RGB) => {
    setMap((current) => {
      const next = { ...current, [name]: rgb };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback((name: string) => {
    setMap((current) => {
      if (!(name in current)) return current;
      const { [name]: _, ...rest } = current;
      persist(rest);
      return rest;
    });
  }, []);

  const resetAll = useCallback(() => {
    setMap({});
    persist({});
  }, []);

  return { getOverride, override, reset, resetAll };
}
