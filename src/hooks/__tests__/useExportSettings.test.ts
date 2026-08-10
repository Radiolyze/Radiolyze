import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useExportSettings } from "../useExportSettings";

describe("useExportSettings", () => {
  it("starts on the Radiolyze format, verified-only, an 80/20 split and no images", () => {
    const { result } = renderHook(() => useExportSettings());

    expect(result.current.settings).toEqual({
      format: "radiolyze",
      verifiedOnly: true,
      splitRatio: 0.8,
      categories: [],
      includeImages: false,
    });
  });

  it("adds and removes a category on repeated toggles", () => {
    const { result } = renderHook(() => useExportSettings());

    act(() => result.current.toggleCategory("nodule"));
    act(() => result.current.toggleCategory("mass"));
    expect(result.current.selectedCategories).toEqual(["nodule", "mass"]);

    act(() => result.current.toggleCategory("nodule"));
    expect(result.current.selectedCategories).toEqual(["mass"]);
  });

  it("clears the whole category selection at once", () => {
    const { result } = renderHook(() => useExportSettings());

    act(() => result.current.toggleCategory("nodule"));
    act(() => result.current.toggleCategory("mass"));
    act(() => result.current.clearCategories());

    expect(result.current.selectedCategories).toEqual([]);
    expect(result.current.settings.categories).toEqual([]);
  });

  it("keeps the slider's array shape but hands the requests a scalar", () => {
    const { result } = renderHook(() => useExportSettings());

    act(() => result.current.setSplitRatio([0.55]));

    expect(result.current.splitRatio).toEqual([0.55]);
    expect(result.current.settings.splitRatio).toBe(0.55);
  });

  it("keeps the settings object stable while nothing changes", () => {
    // The manifest hook clears itself when these change, so a fresh identity on
    // every render would wipe a generated manifest on any unrelated re-render.
    const { result, rerender } = renderHook(() => useExportSettings());

    const first = result.current.settings;
    rerender();
    expect(result.current.settings).toBe(first);

    act(() => result.current.setVerifiedOnly(false));
    expect(result.current.settings).not.toBe(first);
  });
});
