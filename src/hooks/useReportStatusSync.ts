import i18n from "@/i18n";
import { useState, useCallback } from "react";
import { useWebSocket, ReportStatusEvent, ReportStatusPayload } from "./useWebSocket";
import type { QueueItem } from "@/types/radiology";
import { useToast } from "@/hooks/use-toast";

interface ReportStatusMap {
  [reportId: string]: ReportStatusPayload;
}

export function useReportStatusSync(initialItems: QueueItem[] = []) {
  const { toast } = useToast();
  const [statusMap, setStatusMap] = useState<ReportStatusMap>({});

  const handleReportStatus = useCallback(
    (event: ReportStatusEvent) => {
      const { reportId, payload } = event;

      setStatusMap((prev) => ({
        ...prev,
        [reportId]: {
          ...prev[reportId],
          ...payload,
        },
      }));

      // Show toast for significant status changes
      if (payload.qaStatus === "fail") {
        toast({
          title: i18n.t("errors:qa.failedTitle"),
          description: i18n.t("errors:qa.failedDescription", { report: reportId.slice(0, 8) }),
          variant: "destructive",
        });
      } else if (payload.qaStatus === "pass") {
        toast({
          title: i18n.t("errors:qa.passedTitle"),
          description: i18n.t("errors:qa.passedDescription", { report: reportId.slice(0, 8) }),
        });
      }
    },
    [toast],
  );

  const { isConnected, lastEvent } = useWebSocket({
    onReportStatus: handleReportStatus,
  });

  // Merge live status with queue items
  const getEnhancedItems = useCallback(
    (items: QueueItem[]): QueueItem[] => {
      if (!Array.isArray(items)) return [];
      return items.map((item) => {
        const liveStatus = statusMap[item.report.id];
        if (!liveStatus) return item;

        return {
          ...item,
          report: {
            ...item.report,
            status: liveStatus.status || item.report.status,
            qaStatus: liveStatus.qaStatus || item.report.qaStatus,
            aiStatus: liveStatus.aiStatus || item.report.aiStatus,
          },
        };
      });
    },
    [statusMap],
  );

  // Get live status for a specific report
  const getReportStatus = useCallback(
    (reportId: string): ReportStatusPayload | undefined => {
      return statusMap[reportId];
    },
    [statusMap],
  );

  return {
    isConnected,
    lastEvent,
    statusMap,
    getEnhancedItems,
    getReportStatus,
  };
}
