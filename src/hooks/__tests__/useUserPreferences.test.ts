import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUserPreferences } from '../useUserPreferences';

const STORAGE_KEY = 'radiolyze-user-preferences';

describe('useUserPreferences – viewportWL', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults viewportWL to an empty record', () => {
    const { result } = renderHook(() => useUserPreferences());
    expect(result.current.preferences.viewportWL).toEqual({});
  });

  it('persists per-modality window/level across remounts', () => {
    const first = renderHook(() => useUserPreferences());
    act(() => {
      first.result.current.setPreference('viewportWL', {
        CT: { windowWidth: 400, windowCenter: 40 },
      });
    });

    const second = renderHook(() => useUserPreferences());
    expect(second.result.current.preferences.viewportWL).toEqual({
      CT: { windowWidth: 400, windowCenter: 40 },
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').viewportWL).toEqual({
      CT: { windowWidth: 400, windowCenter: 40 },
    });
  });

  it('keeps separate window/level per modality', () => {
    const { result } = renderHook(() => useUserPreferences());
    act(() => {
      result.current.setPreference('viewportWL', {
        CT: { windowWidth: 400, windowCenter: 40 },
      });
    });
    act(() => {
      result.current.setPreference('viewportWL', {
        ...result.current.preferences.viewportWL,
        MR: { windowWidth: 800, windowCenter: 300 },
      });
    });
    expect(result.current.preferences.viewportWL).toEqual({
      CT: { windowWidth: 400, windowCenter: 40 },
      MR: { windowWidth: 800, windowCenter: 300 },
    });
  });
});
