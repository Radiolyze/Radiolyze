import type { Series } from "@/types/radiology";
import type { LabelDisplayState, SegmentationLabel } from "@/types/segmentation";

/**
 * Pure label logic behind the 3D mesh viewer: which labels get pre-fetched,
 * which ones the filter bar shows, and how a manifest colour becomes a swatch.
 *
 * Kept out of the component so the rules can be exercised without standing up
 * vtk.js and a render window.
 */

/**
 * How many labels are loaded up front for a large manifest. A "total" body
 * segmentation carries 100+ organs; fetching every mesh at once is minutes of
 * network for meshes the radiologist will never look at, so only the largest
 * are pre-fetched and the rest load when toggled on.
 */
export const PREFETCH_TOP_N = 10;

/**
 * Above this label count the panel switches to its large-manifest mode: search
 * and a minimum-volume slider appear, and only the top-N labels start visible.
 */
export const LARGE_MANIFEST_THRESHOLD = 20;

export type SortMode = "volume" | "name";

export function isLargeManifest(labelCount: number): boolean {
  return labelCount > LARGE_MANIFEST_THRESHOLD;
}

export function defaultLabelState(
  label: SegmentationLabel,
  options: { visible: boolean },
): LabelDisplayState {
  return {
    visible: options.visible,
    opacity: 1,
    color: label.color,
  };
}

/** Ids of the `n` largest labels by volume. */
export function topByVolume(labels: SegmentationLabel[], n: number): Set<number> {
  return new Set(
    [...labels]
      .sort((a, b) => b.volume_ml - a.volume_ml)
      .slice(0, n)
      .map((label) => label.id),
  );
}

/**
 * The set of labels that are visible when a manifest is first hydrated: all of
 * them for a small manifest, the largest {@link PREFETCH_TOP_N} for a big one.
 */
export function initiallyVisibleLabels(labels: SegmentationLabel[]): Set<number> {
  return isLargeManifest(labels.length)
    ? topByVolume(labels, PREFETCH_TOP_N)
    : new Set(labels.map((label) => label.id));
}

export interface LabelFilterOptions {
  search: string;
  minVolumeMl: number;
  sortMode: SortMode;
}

/** Applies the panel's search and minimum-volume filters, then sorts. */
export function filterAndSortLabels(
  labels: SegmentationLabel[],
  { search, minVolumeMl, sortMode }: LabelFilterOptions,
): SegmentationLabel[] {
  const term = search.trim().toLowerCase();
  const filtered = labels.filter((label) => {
    if (label.volume_ml < minVolumeMl) return false;
    if (term && !label.name.toLowerCase().includes(term)) return false;
    return true;
  });
  return sortMode === "name"
    ? filtered.slice().sort((a, b) => a.name.localeCompare(b.name))
    : filtered.slice().sort((a, b) => b.volume_ml - a.volume_ml);
}

/**
 * Surface rendering only makes sense for a CT volume with enough slices to
 * segment; anything else gets the "unsupported" placeholder.
 */
export function supportsMeshRendering(series: Series | null): boolean {
  if (!series) return false;
  return series.modality === "CT" && (series.frameCount ?? 0) >= 30;
}

/** vtk colours are 0..1 per channel; CSS wants 0..255. */
export function toCssColor(rgb: readonly [number, number, number]): string {
  return `rgb(${rgb.map((channel) => Math.round(channel * 255)).join(",")})`;
}

/** Manifest label names are snake_case (`rib_left_3`); show them as words. */
export function formatLabelName(name: string): string {
  return name.replace(/_/g, " ");
}
