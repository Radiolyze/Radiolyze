import { CheckCircle, Clock, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import type { HistoryStats } from "@/hooks/useHistoryFilters";

interface HistoryStatsGridProps {
  stats: HistoryStats;
}

export function HistoryStatsGrid({ stats }: HistoryStatsGridProps) {
  const { t } = useTranslation("common");
  const { t: tReport } = useTranslation("report");

  const cards = [
    {
      key: "today",
      value: stats.today,
      label: t("time.today"),
      icon: Clock,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      key: "approved",
      value: stats.approved,
      label: t("status.approved"),
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      key: "impressions",
      value: stats.impressions,
      label: tReport("impression.aiDraft"),
      icon: Sparkles,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map(({ key, value, label, icon: Icon, color, bgColor }) => (
        <Card key={key}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bgColor}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
