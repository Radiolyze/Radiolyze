import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { reportClient } from "@/services/reportClient";
import { mapReportResponse } from "@/services/reportMapping";
import { logger } from "@/lib/logger";
import type { BatchReport } from "@/hooks/useBatchReports";

const resolveTurnaroundMinutes = (createdAt: string, updatedAt: string) => {
  const created = Date.parse(createdAt);
  const updated = Date.parse(updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated)) return undefined;
  const diffMinutes = Math.round((updated - created) / 60000);
  return diffMinutes > 0 ? diffMinutes : undefined;
};

interface UseBatchBulkActionsArgs {
  reports: BatchReport[];
  selectedIds: Set<string>;
  setReports: React.Dispatch<React.SetStateAction<BatchReport[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useBatchBulkActions({
  reports,
  selectedIds,
  setReports,
  setSelectedIds,
}: UseBatchBulkActionsArgs) {
  const { t } = useTranslation("batch");
  const { t: tReport } = useTranslation("report");
  const { t: tCommon } = useTranslation("common");

  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);

  const handleBulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsProcessing(true);
    setProcessProgress(0);

    const total = selectedIds.size;
    let processed = 0;
    let approved = 0;
    let failed = 0;

    for (const id of selectedIds) {
      const report = reports.find((item) => item.id === id);
      if (!report || report.status !== "draft" || report.qaStatus !== "pass") {
        processed++;
        setProcessProgress((processed / total) * 100);
        continue;
      }

      try {
        const response = await reportClient.finalizeReport(id, "Batch");
        const updated = mapReportResponse(response);
        approved++;
        setReports((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: updated.status,
                  qaStatus: updated.qaStatus,
                  assignedTo: updated.approvedBy ?? item.assignedTo,
                  turnaroundMinutes: resolveTurnaroundMinutes(updated.createdAt, updated.updatedAt),
                }
              : item,
          ),
        );
      } catch (error) {
        logger.warn("Failed to finalize report", error);
        failed++;
      } finally {
        processed++;
        setProcessProgress((processed / total) * 100);
      }
    }

    setIsProcessing(false);
    setProcessProgress(0);
    setSelectedIds(new Set());

    if (approved > 0) {
      toast.success(t("bulk.completed", { count: approved }));
    }
    if (failed > 0) {
      toast.error(t("bulk.failed", { count: failed }));
    }
  }, [reports, selectedIds, setReports, setSelectedIds, t]);

  const handleBulkExport = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    setProcessProgress(0);

    const ids = Array.from(selectedIds);
    const total = ids.length;
    let processed = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        const result = await reportClient.exportStructuredReport(id, "dicom");
        const url = URL.createObjectURL(result.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.fileName;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        logger.warn("Bulk export failed", error);
        failed++;
      } finally {
        processed++;
        setProcessProgress((processed / total) * 100);
      }
    }

    setIsProcessing(false);
    setProcessProgress(0);
    setSelectedIds(new Set());

    if (failed === 0) {
      toast.success(tReport("export.success"));
    } else {
      toast.error(t("bulk.failed", { count: failed }));
    }
  }, [selectedIds, setSelectedIds, t, tReport]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    toast.error(tCommon("status.error"));
  }, [selectedIds, tCommon]);

  return {
    isProcessing,
    processProgress,
    handleBulkApprove,
    handleBulkExport,
    handleBulkDelete,
  };
}
