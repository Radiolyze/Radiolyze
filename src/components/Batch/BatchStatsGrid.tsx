import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle, Clock, FileText, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { BatchStats } from "@/hooks/useBatchFilters";

interface BatchStatsGridProps {
  stats: BatchStats;
}

export function BatchStatsGrid({ stats }: BatchStatsGridProps) {
  const { t } = useTranslation("batch");

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t("stats.total")}</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-sm text-muted-foreground">{t("stats.pending")}</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">{t("stats.drafts")}</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.drafts}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-sm text-muted-foreground">{t("stats.approved")}</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.approved}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Ø TAT</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.avgTurnaround} min</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-muted-foreground">QA Issues</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.qaWarnings}</p>
        </CardContent>
      </Card>
    </div>
  );
}
