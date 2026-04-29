import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLabelColors } from '../useLabelColors';

const STORAGE_KEY = 'radiolyze:mesh:label-colors';

describe('useLabelColors', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns undefined for unset labels', () => {
    const { result } = renderHook(() => useLabelColors());
    expect(result.current.getOverride('spleen')).toBeUndefined();
  });

  it('persists overrides across remounts via localStorage', () => {
    const first = renderHook(() => useLabelColors());
    act(() => first.result.current.override('spleen', [0.1, 0.2, 0.3]));
    expect(first.result.current.getOverride('spleen')).toEqual([0.1, 0.2, 0.3]);

    const second = renderHook(() => useLabelColors());
    expect(second.result.current.getOverride('spleen')).toEqual([0.1, 0.2, 0.3]);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      spleen: [0.1, 0.2, 0.3],
    });
  });

  it('reset() removes a single label', () => {
    const { result } = renderHook(() => useLabelColors());
    act(() => result.current.override('liver', [0.5, 0.5, 0.5]));
    act(() => result.current.override('spleen', [0.6, 0.6, 0.6]));
    act(() => result.current.reset('liver'));
    expect(result.current.getOverride('liver')).toBeUndefined();
    expect(result.current.getOverride('spleen')).toEqual([0.6, 0.6, 0.6]);
  });

  it('resetAll() drops every override', () => {
    const { result } = renderHook(() => useLabelColors());
    act(() => result.current.override('liver', [0.5, 0.5, 0.5]));
    act(() => result.current.override('spleen', [0.6, 0.6, 0.6]));
    act(() => result.current.resetAll());
    expect(result.current.getOverride('liver')).toBeUndefined();
    expect(result.current.getOverride('spleen')).toBeUndefined();
  });

  it('ignores corrupt localStorage values', () => {
    window.localStorage.setItem(STORAGE_KEY, '<<not json>>');
    const { result } = renderHook(() => useLabelColors());
    expect(result.current.getOverride('spleen')).toBeUndefined();
  });
});
