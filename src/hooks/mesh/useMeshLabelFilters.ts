import { useCallback, useMemo, useState } from "react";
import type { SegmentationLabel } from "@/types/segmentation";
import { filterAndSortLabels, type SortMode } from "@/lib/meshLabels";

export interface UseMeshLabelFiltersResult {
  search: string;
  setSearch: (value: string) => void;
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  minVolumeMl: number;
  setMinVolumeMl: (value: number) => void;
  /** `labels` after the search and minimum-volume filters, in the chosen order. */
  displayedLabels: SegmentationLabel[];
  /** Clears search and minimum volume; the sort order is left alone. */
  reset: () => void;
}

/**
 * Search, minimum-volume and sort state over a segmentation manifest's labels.
 *
 * The sort mode survives {@link UseMeshLabelFiltersResult.reset} on purpose: it
 * is a display preference, not part of the job being viewed.
 */
export function useMeshLabelFilters(labels: SegmentationLabel[]): UseMeshLabelFiltersResult {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("volume");
  const [minVolumeMl, setMinVolumeMl] = useState(0);

  const displayedLabels = useMemo(
    () => filterAndSortLabels(labels, { search, minVolumeMl, sortMode }),
    [labels, search, minVolumeMl, sortMode],
  );

  const reset = useCallback(() => {
    setSearch("");
    setMinVolumeMl(0);
  }, []);

  return {
    search,
    setSearch,
    sortMode,
    setSortMode,
    minVolumeMl,
    setMinVolumeMl,
    displayedLabels,
    reset,
  };
}
