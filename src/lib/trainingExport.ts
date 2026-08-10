/**
 * Export arithmetic and request shaping for the training-data page.
 *
 * The page turns five settings into two different request shapes — a full
 * export and a manifest preview — that overlap in all but a couple of fields.
 * Keeping the overlap here means a rule such as "an empty category selection
 * means all categories" is written once instead of at each call site.
 */

import type {
  ExportFormat,
  ExportRequest,
  ExportStats,
  ManifestRequest,
} from "@/services/trainingClient";

/**
 * Split-ratio slider bounds, shared with the labels underneath it. Keeping the
 * percentages out of the resources means a bound can only be changed in one place.
 */
export const SPLIT_MIN = 0.5;
export const SPLIT_MAX = 0.95;

/** The five settings that define an export, as the page holds them. */
export interface ExportSettingsValues {
  format: ExportFormat;
  verifiedOnly: boolean;
  splitRatio: number;
  categories: string[];
  includeImages: boolean;
}

/** Train/validation counts for the current split. */
export interface SplitCounts {
  trainCount: number;
  valCount: number;
}

/**
 * The selected categories, or `undefined` for "no filter".
 *
 * The API reads an absent `categories` as all categories and an empty array as
 * none, so an empty selection has to be dropped rather than sent.
 */
export const categoriesFilter = (categories: string[]): string[] | undefined =>
  categories.length > 0 ? categories : undefined;

/**
 * Share of annotations that are verified, rounded to whole percent.
 *
 * An empty dataset divides zero by zero; the `NaN` that produces is absorbed
 * here rather than rendered, so the progress bar reads 0% before any data exists.
 */
export const computeVerifiedPercentage = (stats?: ExportStats): number => {
  if (!stats) return 0;
  return Math.round((stats.verifiedAnnotations / stats.totalAnnotations) * 100) || 0;
};

/**
 * How the annotations divide at the current ratio.
 *
 * Validation is the remainder rather than its own rounding, so the two always
 * add back up to the total.
 */
export const computeSplitCounts = (
  stats: ExportStats | undefined,
  splitRatio: number,
): SplitCounts => {
  if (!stats) return { trainCount: 0, valCount: 0 };
  const trainCount = Math.round(stats.totalAnnotations * splitRatio);
  return { trainCount, valCount: stats.totalAnnotations - trainCount };
};

/** The full-export request for the current settings. */
export const buildExportRequest = (settings: ExportSettingsValues): ExportRequest => ({
  format: settings.format,
  verifiedOnly: settings.verifiedOnly,
  splitRatio: settings.splitRatio,
  categories: categoriesFilter(settings.categories),
  includeImages: settings.includeImages,
});

/**
 * A manifest request for the current settings.
 *
 * `limit` is left off for the download, which wants every entry, and set for
 * the on-screen previews. `checkImages` makes the backend fetch each image to
 * report whether it is reachable, so it is opt-in per call.
 */
export const buildManifestRequest = (
  settings: Pick<ExportSettingsValues, "verifiedOnly" | "splitRatio" | "categories">,
  limit?: number,
  checkImages?: boolean,
): ManifestRequest => ({
  verifiedOnly: settings.verifiedOnly,
  splitRatio: settings.splitRatio,
  categories: categoriesFilter(settings.categories),
  limit,
  checkImages,
});

/** Filename for a downloaded manifest, dated so successive exports do not collide. */
export const manifestFilename = (now: Date = new Date()): string =>
  `radiolyze-manifest-${now.toISOString().slice(0, 10)}.json`;
