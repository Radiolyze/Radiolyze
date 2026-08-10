import { describe, it, expect } from "vitest";
import type { Series } from "@/types/radiology";
import type { SegmentationLabel } from "@/types/segmentation";
import {
  LARGE_MANIFEST_THRESHOLD,
  PREFETCH_TOP_N,
  defaultLabelState,
  filterAndSortLabels,
  formatLabelName,
  initiallyVisibleLabels,
  isLargeManifest,
  supportsMeshRendering,
  toCssColor,
  topByVolume,
} from "../meshLabels";

const label = (overrides: Partial<SegmentationLabel> = {}): SegmentationLabel => ({
  id: 1,
  name: "liver",
  color: [0.5, 0.25, 0.75],
  volume_ml: 100,
  voxel_count: 1000,
  mask_url: "/mask/1",
  mesh_url: "/mesh/1",
  ...overrides,
});

const labelsOfSize = (n: number): SegmentationLabel[] =>
  Array.from({ length: n }, (_, i) =>
    label({ id: i + 1, name: `organ_${i + 1}`, volume_ml: n - i }),
  );

const series = (overrides: Partial<Series> = {}): Series => ({
  id: "series-1",
  studyId: "study-1",
  seriesNumber: 1,
  seriesDescription: "CT Thorax",
  modality: "CT",
  frameCount: 120,
  ...overrides,
});

describe("defaultLabelState", () => {
  it("starts fully opaque in the manifest colour", () => {
    expect(defaultLabelState(label(), { visible: true })).toEqual({
      visible: true,
      opacity: 1,
      color: [0.5, 0.25, 0.75],
    });
  });

  it("carries the requested visibility through", () => {
    expect(defaultLabelState(label(), { visible: false }).visible).toBe(false);
  });
});

describe("topByVolume", () => {
  it("picks the n largest labels", () => {
    const labels = [
      label({ id: 1, volume_ml: 10 }),
      label({ id: 2, volume_ml: 300 }),
      label({ id: 3, volume_ml: 50 }),
    ];
    expect(topByVolume(labels, 2)).toEqual(new Set([2, 3]));
  });

  it("returns every label when n exceeds the list", () => {
    expect(topByVolume(labelsOfSize(3), 10).size).toBe(3);
  });

  it("does not reorder the input", () => {
    const labels = [label({ id: 1, volume_ml: 10 }), label({ id: 2, volume_ml: 300 })];
    topByVolume(labels, 1);
    expect(labels.map((item) => item.id)).toEqual([1, 2]);
  });
});

describe("isLargeManifest", () => {
  it("is false at the threshold and true above it", () => {
    expect(isLargeManifest(LARGE_MANIFEST_THRESHOLD)).toBe(false);
    expect(isLargeManifest(LARGE_MANIFEST_THRESHOLD + 1)).toBe(true);
  });
});

describe("initiallyVisibleLabels", () => {
  it("shows everything in a small manifest", () => {
    const labels = labelsOfSize(LARGE_MANIFEST_THRESHOLD);
    expect(initiallyVisibleLabels(labels).size).toBe(LARGE_MANIFEST_THRESHOLD);
  });

  it("shows only the largest labels in a big one", () => {
    // labelsOfSize descends by volume, so the top-N are ids 1..N.
    const visible = initiallyVisibleLabels(labelsOfSize(120));
    expect(visible.size).toBe(PREFETCH_TOP_N);
    expect([...visible].sort((a, b) => a - b)).toEqual(
      Array.from({ length: PREFETCH_TOP_N }, (_, i) => i + 1),
    );
  });

  it("handles an empty manifest", () => {
    expect(initiallyVisibleLabels([]).size).toBe(0);
  });
});

describe("filterAndSortLabels", () => {
  const labels = [
    label({ id: 1, name: "spleen", volume_ml: 80 }),
    label({ id: 2, name: "liver", volume_ml: 1500 }),
    label({ id: 3, name: "rib_left_1", volume_ml: 5 }),
  ];
  const base = { search: "", minVolumeMl: 0, sortMode: "volume" as const };

  it("sorts by descending volume by default", () => {
    expect(filterAndSortLabels(labels, base).map((item) => item.id)).toEqual([2, 1, 3]);
  });

  it("sorts alphabetically in name mode", () => {
    expect(filterAndSortLabels(labels, { ...base, sortMode: "name" }).map((l) => l.name)).toEqual([
      "liver",
      "rib_left_1",
      "spleen",
    ]);
  });

  it("matches the search term case-insensitively on the raw name", () => {
    expect(filterAndSortLabels(labels, { ...base, search: "LIV" }).map((l) => l.id)).toEqual([2]);
    // The underscore form is what is searched, not the display form.
    expect(filterAndSortLabels(labels, { ...base, search: "rib_left" }).map((l) => l.id)).toEqual([
      3,
    ]);
  });

  it("ignores surrounding whitespace in the search term", () => {
    expect(filterAndSortLabels(labels, { ...base, search: "  liver  " }).map((l) => l.id)).toEqual([
      2,
    ]);
  });

  it("drops labels below the minimum volume", () => {
    expect(filterAndSortLabels(labels, { ...base, minVolumeMl: 80 }).map((l) => l.id)).toEqual([
      2, 1,
    ]);
  });

  it("applies search and minimum volume together", () => {
    const result = filterAndSortLabels(labels, { ...base, search: "e", minVolumeMl: 100 });
    expect(result.map((l) => l.id)).toEqual([2]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterAndSortLabels(labels, { ...base, search: "pancreas" })).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [...labels];
    filterAndSortLabels(input, { ...base, sortMode: "name" });
    expect(input.map((item) => item.id)).toEqual([1, 2, 3]);
  });
});

describe("supportsMeshRendering", () => {
  it("accepts a CT series with enough frames", () => {
    expect(supportsMeshRendering(series({ frameCount: 30 }))).toBe(true);
  });

  it("rejects a thin CT stack", () => {
    expect(supportsMeshRendering(series({ frameCount: 29 }))).toBe(false);
  });

  it("rejects a series with no frame count", () => {
    expect(supportsMeshRendering(series({ frameCount: undefined }))).toBe(false);
  });

  it("rejects non-CT modalities", () => {
    expect(supportsMeshRendering(series({ modality: "MR" }))).toBe(false);
  });

  it("rejects no series at all", () => {
    expect(supportsMeshRendering(null)).toBe(false);
  });
});

describe("toCssColor", () => {
  it("scales vtk 0..1 channels to 0..255", () => {
    expect(toCssColor([0, 0.5, 1])).toBe("rgb(0,128,255)");
  });

  it("rounds rather than truncates", () => {
    expect(toCssColor([0.93, 0.87, 0.74])).toBe("rgb(237,222,189)");
  });
});

describe("formatLabelName", () => {
  it("turns snake_case into words", () => {
    expect(formatLabelName("rib_left_10")).toBe("rib left 10");
  });

  it("leaves a single-word name alone", () => {
    expect(formatLabelName("liver")).toBe("liver");
  });
});
