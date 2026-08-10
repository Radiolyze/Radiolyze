import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { buildExportRequest, type ExportSettingsValues } from "@/lib/trainingExport";
import { exportAndDownload } from "@/services/trainingClient";

/**
 * Runs the dataset export for the current settings.
 *
 * The download itself happens inside `exportAndDownload`, so success here means
 * the browser was handed the ZIP, not that the user kept it.
 */
export function useTrainingExport(settings: ExportSettingsValues) {
  const { t } = useTranslation("training");

  const { mutate, isPending } = useMutation({
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

  const exportDataset = useCallback(() => {
    mutate(buildExportRequest(settings));
  }, [mutate, settings]);

  return { exportDataset, isExporting: isPending };
}
