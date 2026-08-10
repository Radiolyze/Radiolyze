import { Trans, useTranslation } from "react-i18next";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ExportFormat, ExportStats } from "@/services/trainingClient";
import { FORMAT_INFO } from "./formatInfo";

interface TrainingExportActionProps {
  stats?: ExportStats;
  statsLoading: boolean;
  selectedFormat: ExportFormat;
  includeImages: boolean;
  isExporting: boolean;
  onExport: () => void;
}

export function TrainingExportAction({
  stats,
  statsLoading,
  selectedFormat,
  includeImages,
  isExporting,
  onExport,
}: TrainingExportActionProps) {
  const { t } = useTranslation("training");
  const hasAnnotations = Boolean(stats?.totalAnnotations);

  return (
    <Card className="mt-6">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{t("export.readyTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("export.readySummary", {
                count: stats?.totalAnnotations || 0,
                format: FORMAT_INFO[selectedFormat].name,
              })}
            </p>
          </div>
          <Button size="lg" onClick={onExport} disabled={isExporting || !hasAnnotations}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("export.inProgress")}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t("export.action")}
              </>
            )}
          </Button>
        </div>
        {includeImages && (
          <div className="mt-3 text-xs text-muted-foreground">
            <Trans t={t} i18nKey="export.zipHint" components={{ code: <code /> }} />
          </div>
        )}

        {/* Only an empty dataset, not a pending one: the loading state would
            otherwise flash "nothing to export" before the first stats arrive. */}
        {!hasAnnotations && !statsLoading && (
          <div className="mt-4 p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning">{t("empty.title")}</p>
              <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
