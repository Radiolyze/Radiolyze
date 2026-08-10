import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { SegmentationLabel } from "@/types/segmentation";
import { useMeshLabelFilters } from "../useMeshLabelFilters";

const label = (id: number, name: string, volume_ml: number): SegmentationLabel => ({
  id,
  name,
  color: [1, 0, 0],
  volume_ml,
  voxel_count: 1,
  mask_url: "a",
  mesh_url: "b",
});

const labels = [
  label(1, "spleen", 80),
  label(2, "liver", 1500),
  label(3, "rib_left_1", 5),
  label(4, "rib_left_2", 4),
];

describe("useMeshLabelFilters", () => {
  it("starts unfiltered and sorted by volume", () => {
    const { result } = renderHook(() => useMeshLabelFilters(labels));
    expect(result.current.search).toBe("");
    expect(result.current.minVolumeMl).toBe(0);
    expect(result.current.sortMode).toBe("volume");
    expect(result.current.displayedLabels.map((l) => l.id)).toEqual([2, 1, 3, 4]);
  });

  it("narrows the list as the user types", () => {
    const { result } = renderHook(() => useMeshLabelFilters(labels));
    act(() => result.current.setSearch("rib"));
    expect(result.current.displayedLabels.map((l) => l.id)).toEqual([3, 4]);
  });

  it("applies the minimum-volume floor", () => {
    const { result } = renderHook(() => useMeshLabelFilters(labels));
    act(() => result.current.setMinVolumeMl(50));
    expect(result.current.displayedLabels.map((l) => l.id)).toEqual([2, 1]);
  });

  it("switches to alphabetical order", () => {
    const { result } = renderHook(() => useMeshLabelFilters(labels));
    act(() => result.current.setSortMode("name"));
    expect(result.current.displayedLabels.map((l) => l.name)).toEqual([
      "liver",
      "rib_left_1",
      "rib_left_2",
      "spleen",
    ]);
  });

  it("clears search and minimum volume on reset but keeps the sort order", () => {
    const { result } = renderHook(() => useMeshLabelFilters(labels));
    act(() => {
      result.current.setSearch("rib");
      result.current.setMinVolumeMl(3);
      result.current.setSortMode("name");
    });

    act(() => result.current.reset());

    expect(result.current.search).toBe("");
    expect(result.current.minVolumeMl).toBe(0);
    // The sort order is a display preference, not part of the job.
    expect(result.current.sortMode).toBe("name");
    expect(result.current.displayedLabels).toHaveLength(4);
  });

  it("follows a new manifest's labels", () => {
    const { result, rerender } = renderHook(({ items }) => useMeshLabelFilters(items), {
      initialProps: { items: labels },
    });
    rerender({ items: [label(9, "aorta", 20)] });
    expect(result.current.displayedLabels.map((l) => l.id)).toEqual([9]);
  });

  it("survives an empty manifest", () => {
    const { result } = renderHook(() => useMeshLabelFilters([]));
    expect(result.current.displayedLabels).toEqual([]);
  });
});
