import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { exportAndDownload } from "@/services/trainingClient";
import { buildExportRequest, type ExportSettingsValues } from "@/lib/trainingExport";

export interface UseTrainingExportResult {
  isExporting: boolean;
  runExport: () => void;
}

/**
 * The export itself: build the request from the current settings, download the
 * archive the backend streams back, and report either outcome as a toast.
 */
export function useTrainingExport(settings: ExportSettingsValues): UseTrainingExportResult {
  const { t } = useTranslation("training");

  const exportMutation = useMutation({
    mutationFn: exportAndDownload,
    onSuccess: () => {
      toast.success(t("toast.exportSuccess"), {
        description: t("toast.exportSuccessDescription"),
      });
    },
    onError: (error: Error) => {
      toast.error(t("toast.exportError"), {
        description: error.message,
      });
    },
  });

  const { mutate } = exportMutation;

  const runExport = useCallback(() => {
    mutate(buildExportRequest(settings));
  }, [mutate, settings]);

  return { isExporting: exportMutation.isPending, runExport };
}
