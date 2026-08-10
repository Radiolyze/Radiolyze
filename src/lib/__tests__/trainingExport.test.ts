import { describe, it, expect } from "vitest";
import type { ExportStats } from "@/services/trainingClient";
import {
  SPLIT_MAX,
  SPLIT_MIN,
  buildExportRequest,
  buildManifestRequest,
  categoriesFilter,
  computeSplitCounts,
  computeVerifiedPercentage,
  manifestFilename,
  type ExportSettingsValues,
} from "../trainingExport";

const stats = (overrides: Partial<ExportStats> = {}): ExportStats => ({
  totalAnnotations: 40,
  verifiedAnnotations: 30,
  categories: {},
  studies: 3,
  series: 5,
  ...overrides,
});

const settings = (overrides: Partial<ExportSettingsValues> = {}): ExportSettingsValues => ({
  format: "radiolyze",
  verifiedOnly: true,
  splitRatio: 0.8,
  categories: [],
  includeImages: false,
  ...overrides,
});

describe("categoriesFilter", () => {
  it("passes a non-empty selection through", () => {
    expect(categoriesFilter(["nodule", "mass"])).toEqual(["nodule", "mass"]);
  });

  it("drops an empty selection so the API reads it as no filter", () => {
    // An empty array would mean "no categories at all" to the backend, which
    // is the opposite of what an untouched filter should express.
    expect(categoriesFilter([])).toBeUndefined();
  });
});

describe("computeVerifiedPercentage", () => {
  it("rounds the verified share to whole percent", () => {
    expect(
      computeVerifiedPercentage(stats({ totalAnnotations: 40, verifiedAnnotations: 30 })),
    ).toBe(75);
    expect(computeVerifiedPercentage(stats({ totalAnnotations: 3, verifiedAnnotations: 1 }))).toBe(
      33,
    );
  });

  it("reads 0 before any stats have arrived", () => {
    expect(computeVerifiedPercentage(undefined)).toBe(0);
  });

  it("reads 0 rather than NaN for an empty dataset", () => {
    // 0/0 is NaN, which would reach the progress bar and the label.
    const result = computeVerifiedPercentage(
      stats({ totalAnnotations: 0, verifiedAnnotations: 0 }),
    );
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });

  it("reads 100 when everything is verified", () => {
    expect(
      computeVerifiedPercentage(stats({ totalAnnotations: 12, verifiedAnnotations: 12 })),
    ).toBe(100);
  });
});

describe("computeSplitCounts", () => {
  it("divides the annotations at the given ratio", () => {
    expect(computeSplitCounts(stats({ totalAnnotations: 40 }), 0.8)).toEqual({
      trainCount: 32,
      valCount: 8,
    });
  });

  it("keeps the two halves adding up to the total at every bound", () => {
    // Validation is the remainder, not its own rounding, so an odd total can
    // never lose or gain an annotation between the two figures.
    for (const total of [1, 3, 7, 41, 99]) {
      for (const ratio of [SPLIT_MIN, 0.7, 0.8, SPLIT_MAX]) {
        const { trainCount, valCount } = computeSplitCounts(
          stats({ totalAnnotations: total }),
          ratio,
        );
        expect(trainCount + valCount).toBe(total);
        expect(valCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("reads zero for both before any stats have arrived", () => {
    expect(computeSplitCounts(undefined, 0.8)).toEqual({ trainCount: 0, valCount: 0 });
  });
});

describe("buildExportRequest", () => {
  it("carries the settings through unchanged", () => {
    expect(
      buildExportRequest(
        settings({
          format: "coco",
          verifiedOnly: false,
          splitRatio: 0.6,
          categories: ["nodule"],
          includeImages: true,
        }),
      ),
    ).toEqual({
      format: "coco",
      verifiedOnly: false,
      splitRatio: 0.6,
      categories: ["nodule"],
      includeImages: true,
    });
  });

  it("omits an empty category selection", () => {
    expect(buildExportRequest(settings({ categories: [] })).categories).toBeUndefined();
  });
});

describe("buildManifestRequest", () => {
  it("limits the preview and leaves the image check off by default", () => {
    expect(buildManifestRequest(settings({ categories: ["mass"] }), 50)).toEqual({
      verifiedOnly: true,
      splitRatio: 0.8,
      categories: ["mass"],
      limit: 50,
      checkImages: undefined,
    });
  });

  it("asks for the image check when told to", () => {
    expect(buildManifestRequest(settings(), 50, true).checkImages).toBe(true);
  });

  it("leaves the limit off for the full download", () => {
    const request = buildManifestRequest(settings(), undefined, true);
    expect(request.limit).toBeUndefined();
    expect(request.checkImages).toBe(true);
  });

  it("does not carry the export format, which a manifest has no use for", () => {
    expect(buildManifestRequest(settings({ format: "coco" }))).not.toHaveProperty("format");
  });
});

describe("manifestFilename", () => {
  it("dates the file so successive downloads do not collide", () => {
    expect(manifestFilename(new Date("2026-08-10T18:30:00.000Z"))).toBe(
      "radiolyze-manifest-2026-08-10.json",
    );
  });

  it("uses the UTC day, not the local one", () => {
    // Late-evening UTC-negative offsets would otherwise name the file with
    // yesterday's date on one machine and today's on another.
    expect(manifestFilename(new Date("2026-08-10T23:59:59.000Z"))).toBe(
      "radiolyze-manifest-2026-08-10.json",
    );
  });
});
