import { describe, it, expect } from "vitest";
import {
  MANIFEST_PREVIEW_ROWS,
  SPLIT_MAX,
  SPLIT_MIN,
  buildExportRequest,
  buildManifestRequest,
  categoryFilter,
  manifestBlob,
  manifestErrorEntries,
  manifestFilename,
  splitCounts,
  verifiedPercentage,
  type ExportSettingsValues,
} from "../trainingExport";
import type { ExportStats, ManifestEntry, ManifestResponse } from "@/services/trainingClient";

const stats = (totalAnnotations: number, verifiedAnnotations = 0): ExportStats => ({
  totalAnnotations,
  verifiedAnnotations,
  categories: {},
  studies: 1,
  series: 1,
});

const settings = (overrides: Partial<ExportSettingsValues> = {}): ExportSettingsValues => ({
  format: "radiolyze",
  verifiedOnly: true,
  splitRatio: 0.8,
  categories: [],
  includeImages: false,
  ...overrides,
});

const entry = (id: string, status?: ManifestEntry["status"], error?: string): ManifestEntry => ({
  id,
  image_path: `images/${id}.png`,
  wado_url: `http://pacs/${id}`,
  study_id: "study-1",
  series_id: "series-1",
  instance_id: id,
  frame_index: 0,
  frame_number: 1,
  splits: ["train"],
  status,
  error,
});

describe("verifiedPercentage", () => {
  it("reports the verified share as a whole percentage", () => {
    expect(verifiedPercentage(stats(40, 30))).toBe(75);
  });

  it("rounds to the nearest whole percent", () => {
    expect(verifiedPercentage(stats(3, 1))).toBe(33);
    expect(verifiedPercentage(stats(3, 2))).toBe(67);
  });

  it("reads an empty corpus as 0 rather than NaN", () => {
    // 0/0 is NaN, and NaN reaching the progress bar renders an empty track with
    // no width at all — indistinguishable from a bar that failed to load.
    expect(verifiedPercentage(stats(0, 0))).toBe(0);
  });

  it("is 0 while the stats have not arrived", () => {
    expect(verifiedPercentage(undefined)).toBe(0);
    expect(verifiedPercentage(null)).toBe(0);
  });

  it("reports a fully verified corpus as 100", () => {
    expect(verifiedPercentage(stats(12, 12))).toBe(100);
  });
});

describe("splitCounts", () => {
  it("divides the corpus at the given ratio", () => {
    expect(splitCounts(stats(100), 0.8)).toEqual({ train: 80, validation: 20 });
  });

  it("keeps the two halves adding up to the total when the ratio does not divide evenly", () => {
    const { train, validation } = splitCounts(stats(7), 0.8);
    expect(train).toBe(6);
    expect(train + validation).toBe(7);
  });

  it("holds at both slider bounds", () => {
    expect(splitCounts(stats(200), SPLIT_MIN)).toEqual({ train: 100, validation: 100 });
    expect(splitCounts(stats(200), SPLIT_MAX)).toEqual({ train: 190, validation: 10 });
  });

  it("is empty while the stats have not arrived", () => {
    expect(splitCounts(undefined, 0.8)).toEqual({ train: 0, validation: 0 });
  });
});

describe("categoryFilter", () => {
  it("passes a selection through", () => {
    expect(categoryFilter(["nodule", "mass"])).toEqual(["nodule", "mass"]);
  });

  it("drops an empty selection rather than sending an empty filter", () => {
    // The API reads `[]` as "match nothing"; omitting the key is what means
    // "no filter", so an untouched category list must not be sent.
    expect(categoryFilter([])).toBeUndefined();
  });
});

describe("buildExportRequest", () => {
  it("carries the settings the export endpoint expects", () => {
    expect(
      buildExportRequest(
        settings({ format: "coco", verifiedOnly: false, splitRatio: 0.6, includeImages: true }),
      ),
    ).toEqual({
      format: "coco",
      verifiedOnly: false,
      splitRatio: 0.6,
      categories: undefined,
      includeImages: true,
    });
  });

  it("narrows an empty category selection away", () => {
    expect(buildExportRequest(settings({ categories: ["nodule"] })).categories).toEqual(["nodule"]);
    expect(buildExportRequest(settings({ categories: [] })).categories).toBeUndefined();
  });
});

describe("buildManifestRequest", () => {
  it("shares the corpus filters with the export but carries no format", () => {
    const request = buildManifestRequest(settings({ format: "coco", categories: ["nodule"] }));
    expect(request).toEqual({
      verifiedOnly: true,
      splitRatio: 0.8,
      categories: ["nodule"],
      limit: undefined,
      checkImages: undefined,
    });
    expect(request).not.toHaveProperty("format");
  });

  it("takes the preview cap and the image check from its options", () => {
    expect(buildManifestRequest(settings(), { limit: 50, checkImages: true })).toMatchObject({
      limit: 50,
      checkImages: true,
    });
  });
});

describe("manifestFilename", () => {
  it("stamps the file with the day it was downloaded", () => {
    expect(manifestFilename(new Date("2026-08-10T13:45:00Z"))).toBe(
      "radiolyze-manifest-2026-08-10.json",
    );
  });

  it("uses the UTC day, so a late-evening download does not roll forward", () => {
    expect(manifestFilename(new Date("2026-08-10T23:59:59Z"))).toBe(
      "radiolyze-manifest-2026-08-10.json",
    );
  });
});

// jsdom's Blob has neither `text()` nor `arrayBuffer()`, so the contents come
// back through the reader the browser has always had.
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe("manifestBlob", () => {
  it("serialises the manifest as pretty-printed JSON", async () => {
    const manifest: ManifestResponse = { total: 1, images: [entry("a")] };
    const blob = manifestBlob(manifest);

    expect(blob.type).toBe("application/json");
    const text = await readBlob(blob);
    expect(JSON.parse(text)).toEqual(manifest);
    // Indented, so the downloaded file is readable rather than one long line.
    expect(text).toContain("\n  ");
  });
});

describe("manifestErrorEntries", () => {
  const manifest: ManifestResponse = {
    total: 5,
    images: [
      entry("ok-1"),
      entry("bad-1", "error", "404"),
      entry("ok-2", "ok"),
      entry("bad-2", "error"),
      entry("bad-3", "error"),
      entry("bad-4", "error"),
    ],
    status: { ok: 2, error: 4 },
  };

  it("keeps only the entries whose image could not be read", () => {
    expect(manifestErrorEntries(manifest, 10).map((e) => e.id)).toEqual([
      "bad-1",
      "bad-2",
      "bad-3",
      "bad-4",
    ]);
  });

  it("caps the list at the preview row count by default", () => {
    expect(manifestErrorEntries(manifest)).toHaveLength(MANIFEST_PREVIEW_ROWS);
  });

  it("is empty for a manifest fetched without an image check", () => {
    expect(manifestErrorEntries({ total: 1, images: [entry("a")] })).toEqual([]);
  });
});
