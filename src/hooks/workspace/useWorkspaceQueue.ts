import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { QueueItem } from "@/types/radiology";
import { useDicomWebQueue } from "@/hooks/useDicomWebQueue";
import { useReportStatusSync } from "@/hooks/useReportStatusSync";
import type { ReportStatusPayload } from "@/hooks/useWebSocket";

export interface UseWorkspaceQueueResult {
  /** The worklist, with live WebSocket status folded into each report. */
  queueItems: QueueItem[];
  isLoading: boolean;
  /** Whether the status WebSocket is up, shown in the sidebar. */
  wsConnected: boolean;
  /** Live status for one report, or `undefined` if none has arrived. */
  getReportStatus: (reportId: string) => ReportStatusPayload | undefined;
}

/**
 * The worklist behind the workspace sidebar.
 *
 * Fetching and the live status feed live together because neither is useful
 * alone here: the DICOMweb query supplies the items and the WebSocket supplies
 * the QA/AI status they are drawn with, so the page only ever wants the merge.
 */
export function useWorkspaceQueue(): UseWorkspaceQueueResult {
  const { items, isLoading, error } = useDicomWebQueue();

  // Defensive: when DICOMweb requests fail, ensure we never call .map on non-arrays.
  const queueItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const { isConnected, getEnhancedItems, getReportStatus } = useReportStatusSync(queueItems);

  const enhancedQueueItems = useMemo(
    () => getEnhancedItems(queueItems),
    [queueItems, getEnhancedItems],
  );

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  return {
    queueItems: enhancedQueueItems,
    isLoading,
    wsConnected: isConnected,
    getReportStatus,
  };
}
