import { useTranslation } from "react-i18next";
import { BarChart3, Layers, Loader2, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ExportStats } from "@/services/trainingClient";
import type { SplitCounts } from "@/lib/trainingExport";

interface TrainingStatsGridProps {
  stats?: ExportStats;
  statsLoading: boolean;
  verifiedPercentage: number;
  splitCounts: SplitCounts;
}

export function TrainingStatsGrid({
  stats,
  statsLoading,
  verifiedPercentage,
  splitCounts,
}: TrainingStatsGridProps) {
  const { t } = useTranslation("training");

  return (
    <div className="grid gap-6 md:grid-cols-3 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {t("stats.annotations")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <div className="text-3xl font-bold">{stats?.totalAnnotations || 0}</div>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={verifiedPercentage} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground">
                  {t("stats.verifiedPercentage", { percent: verifiedPercentage })}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {t("stats.studiesAndSeries")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <div className="flex gap-4">
              <div>
                <div className="text-3xl font-bold">{stats?.studies || 0}</div>
                <div className="text-xs text-muted-foreground">{t("stats.studies")}</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{stats?.series || 0}</div>
                <div className="text-xs text-muted-foreground">{t("stats.series")}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t("stats.split")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div>
              <div className="text-3xl font-bold text-primary">{splitCounts.trainCount}</div>
              <div className="text-xs text-muted-foreground">{t("stats.training")}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-muted-foreground">{splitCounts.valCount}</div>
              <div className="text-xs text-muted-foreground">{t("stats.validation")}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
