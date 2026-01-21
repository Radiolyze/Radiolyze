import { useState, useCallback } from 'react';
import { useWebSocket, ReportStatusEvent, ReportStatusPayload } from './useWebSocket';
import type { QueueItem } from '@/types/radiology';
import { useToast } from '@/hooks/use-toast';

interface ReportStatusMap {
  [reportId: string]: ReportStatusPayload;
}

export function useReportStatusSync(initialItems: QueueItem[] = []) {
  const { toast } = useToast();
  const [statusMap, setStatusMap] = useState<ReportStatusMap>({});

  const handleReportStatus = useCallback((event: ReportStatusEvent) => {
    const { reportId, payload } = event;

    setStatusMap(prev => ({
      ...prev,
      [reportId]: {
        ...prev[reportId],
        ...payload,
      },
    }));

    // Show toast for significant status changes
    if (payload.qaStatus === 'fail') {
      toast({
        title: 'QA-Prüfung fehlgeschlagen',
        description: `Report ${reportId.slice(0, 8)}... hat die QA nicht bestanden.`,
        variant: 'destructive',
      });
    } else if (payload.qaStatus === 'pass') {
      toast({
        title: 'QA-Prüfung bestanden',
        description: `Report ${reportId.slice(0, 8)}... ist bereit zur Freigabe.`,
      });
    }
  }, [toast]);

  const { isConnected, lastEvent } = useWebSocket({
    onReportStatus: handleReportStatus,
  });

  // Merge live status with queue items
  const getEnhancedItems = useCallback((items: QueueItem[]): QueueItem[] => {
    if (!Array.isArray(items)) return [];
    return items.map(item => {
      const liveStatus = statusMap[item.report.id];
      if (!liveStatus) return item;

      return {
        ...item,
        report: {
          ...item.report,
          qaStatus: liveStatus.qaStatus || item.report.qaStatus,
          aiStatus: liveStatus.aiStatus || item.report.aiStatus,
        },
      };
    });
  }, [statusMap]);

  // Get live status for a specific report
  const getReportStatus = useCallback((reportId: string): ReportStatusPayload | undefined => {
    return statusMap[reportId];
  }, [statusMap]);

  return {
    isConnected,
    lastEvent,
    statusMap,
    getEnhancedItems,
    getReportStatus,
  };
}
