import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { SPLIT_DEFAULT } from "@/lib/trainingExport";
import { useExportSettings } from "../useExportSettings";

describe("useExportSettings", () => {
  it("starts on the Radiolyze format with verified-only on and no category filter", () => {
    const { result } = renderHook(() => useExportSettings());

    expect(result.current.format).toBe("radiolyze");
    expect(result.current.verifiedOnly).toBe(true);
    expect(result.current.splitRatio).toEqual([SPLIT_DEFAULT]);
    expect(result.current.categories).toEqual([]);
    expect(result.current.includeImages).toBe(false);
  });

  it("exposes the split ratio as a number for the request and an array for the slider", () => {
    const { result } = renderHook(() => useExportSettings());

    act(() => result.current.setSplitRatio([0.6]));

    expect(result.current.splitRatio).toEqual([0.6]);
    expect(result.current.values.splitRatio).toBe(0.6);
  });

  it("adds and removes a category on repeated toggles", () => {
    const { result } = renderHook(() => useExportSettings());

    act(() => result.current.toggleCategory("nodule"));
    expect(result.current.categories).toEqual(["nodule"]);

    act(() => result.current.toggleCategory("mass"));
    expect(result.current.categories).toEqual(["nodule", "mass"]);

    act(() => result.current.toggleCategory("nodule"));
    expect(result.current.categories).toEqual(["mass"]);
  });

  it("clears the whole category selection at once", () => {
    const { result } = renderHook(() => useExportSettings());

    act(() => result.current.toggleCategory("nodule"));
    act(() => result.current.toggleCategory("mass"));
    act(() => result.current.clearCategories());

    expect(result.current.categories).toEqual([]);
  });

  it("keeps `values` stable while nothing changes", () => {
    // The manifest hook resets on `values` moving, so a fresh identity per
    // render would discard a generated manifest on every unrelated re-render.
    const { result, rerender } = renderHook(() => useExportSettings());

    const before = result.current.values;
    rerender();

    expect(result.current.values).toBe(before);
  });

  it("moves `values` when a setting changes", () => {
    const { result } = renderHook(() => useExportSettings());

    const before = result.current.values;
    act(() => result.current.setVerifiedOnly(false));

    expect(result.current.values).not.toBe(before);
    expect(result.current.values.verifiedOnly).toBe(false);
  });
});
