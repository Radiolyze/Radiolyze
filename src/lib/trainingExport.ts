import type {
  ExportFormat,
  ExportRequest,
  ExportStats,
  ManifestEntry,
  ManifestRequest,
  ManifestResponse,
} from "@/services/trainingClient";

/**
 * Pure export arithmetic behind the training-data page: the split bounds, the
 * counts derived from them, and the request shapes the training API expects.
 *
 * Kept out of the component so the rules can be exercised without standing up
 * react-query and a render tree.
 */

/**
 * Slider bounds, shared with the labels underneath it. Keeping the percentages
 * out of the resources means a bound can only be changed in one place.
 */
export const SPLIT_MIN = 0.5;
export const SPLIT_MAX = 0.95;
export const SPLIT_STEP = 0.05;
export const SPLIT_DEFAULT = 0.8;

/**
 * A manifest preview is capped so the button stays responsive on a corpus with
 * thousands of frames; the download path asks for the whole catalogue instead.
 */
export const MANIFEST_PREVIEW_LIMIT = 50;

/** Rows shown per list in the preview panel, for both entries and errors. */
export const MANIFEST_PREVIEW_ROWS = 3;

/**
 * Share of annotations that have been verified, as a whole percentage.
 *
 * An empty corpus divides zero by zero, so the `NaN` is folded to 0 here rather
 * than reaching the progress bar.
 */
export function verifiedPercentage(stats: ExportStats | undefined | null): number {
  if (!stats) return 0;
  return Math.round((stats.verifiedAnnotations / stats.totalAnnotations) * 100) || 0;
}

export interface SplitCounts {
  train: number;
  validation: number;
}

/**
 * How the corpus divides at the given ratio. Validation is the remainder rather
 * than its own rounding, so the two always add up to the total.
 */
export function splitCounts(stats: ExportStats | undefined | null, ratio: number): SplitCounts {
  if (!stats) return { train: 0, validation: 0 };
  const train = Math.round(stats.totalAnnotations * ratio);
  return { train, validation: stats.totalAnnotations - train };
}

/**
 * The API distinguishes "no category filter" from "an empty filter", so an
 * empty selection has to be dropped rather than sent as `[]`.
 */
export function categoryFilter(categories: string[]): string[] | undefined {
  return categories.length > 0 ? categories : undefined;
}

/** The settings the export and manifest requests are both built from. */
export interface ExportSettingsValues {
  format: ExportFormat;
  verifiedOnly: boolean;
  splitRatio: number;
  categories: string[];
  includeImages: boolean;
}

export function buildExportRequest(settings: ExportSettingsValues): ExportRequest {
  return {
    format: settings.format,
    verifiedOnly: settings.verifiedOnly,
    splitRatio: settings.splitRatio,
    categories: categoryFilter(settings.categories),
    includeImages: settings.includeImages,
  };
}

/**
 * The manifest is built from the same settings as the export minus the format —
 * it catalogues which frames a run would touch, not how they are serialised.
 */
export function buildManifestRequest(
  settings: ExportSettingsValues,
  options: { limit?: number; checkImages?: boolean } = {},
): ManifestRequest {
  return {
    verifiedOnly: settings.verifiedOnly,
    splitRatio: settings.splitRatio,
    categories: categoryFilter(settings.categories),
    limit: options.limit,
    checkImages: options.checkImages,
  };
}

/** Dated so repeated downloads land beside each other instead of overwriting. */
export function manifestFilename(now: Date = new Date()): string {
  return `radiolyze-manifest-${now.toISOString().slice(0, 10)}.json`;
}

export function manifestBlob(manifest: ManifestResponse): Blob {
  return new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
}

/**
 * The entries whose image could not be fetched, capped for the preview panel.
 * Only populated when the manifest was requested with `checkImages`.
 */
export function manifestErrorEntries(
  manifest: ManifestResponse,
  limit: number = MANIFEST_PREVIEW_ROWS,
): ManifestEntry[] {
  return manifest.images.filter((entry) => entry.status === "error").slice(0, limit);
}
