import { useCallback, useEffect, useRef, useState } from "react";
import type { QueueItem, Series } from "@/types/radiology";

interface UseWorkspaceSelectionOptions {
  queueItems: QueueItem[];
  /** Called with every newly selected item, to load its report. */
  onSelectItem: (item: QueueItem) => void;
}

export interface UseWorkspaceSelectionResult {
  selectedQueueItem: QueueItem | null;
  selectedSeries: Series | null;
  selectQueueItem: (item: QueueItem) => void;
  selectSeries: (series: Series) => void;
}

/**
 * Which worklist item and which series the workspace is showing.
 *
 * Selecting an item is one operation with three parts — the item, its first
 * series, and its report — and it happens from two directions: the user
 * clicking the sidebar, and the queue arriving or changing under an existing
 * selection. Both go through `selectQueueItem` so the parts cannot drift apart.
 *
 * The selected id is mirrored in a ref so the queue effect can re-find the
 * current item without taking the selection as a dependency and re-running on
 * its own writes.
 */
export function useWorkspaceSelection({
  queueItems,
  onSelectItem,
}: UseWorkspaceSelectionOptions): UseWorkspaceSelectionResult {
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const selectedItemIdRef = useRef<string | null>(null);

  const onSelectItemRef = useRef(onSelectItem);
  useEffect(() => {
    onSelectItemRef.current = onSelectItem;
  }, [onSelectItem]);

  const selectQueueItem = useCallback((item: QueueItem) => {
    selectedItemIdRef.current = item.id;
    setSelectedQueueItem(item);
    setSelectedSeries(item.study.series[0] || null);
    onSelectItemRef.current(item);
  }, []);

  const selectSeries = useCallback((series: Series) => {
    setSelectedSeries(series);
  }, []);

  // Initialize the selection when queue items load, and keep it pointed at the
  // same item across queue updates — falling back to the first item if the one
  // that was selected has left the worklist.
  useEffect(() => {
    if (queueItems.length === 0) return;

    const previousId = selectedItemIdRef.current;
    const nextItem = previousId
      ? queueItems.find((item) => item.id === previousId) || queueItems[0]
      : queueItems[0];

    selectQueueItem(nextItem);
  }, [queueItems, selectQueueItem]);

  return { selectedQueueItem, selectedSeries, selectQueueItem, selectSeries };
}
