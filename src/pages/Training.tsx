import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExportSettings } from "@/hooks/training/useExportSettings";
import { useTrainingData } from "@/hooks/training/useTrainingData";
import { useTrainingExport } from "@/hooks/training/useTrainingExport";
import { useTrainingManifest } from "@/hooks/training/useTrainingManifest";
import { TrainingStatsGrid } from "@/components/Training/TrainingStatsGrid";
import { ExportFormatCard } from "@/components/Training/ExportFormatCard";
import { ExportSettingsCard } from "@/components/Training/ExportSettingsCard";
import { ExportActionCard } from "@/components/Training/ExportActionCard";

export default function Training() {
  const { t } = useTranslation("training");

  const settings = useExportSettings();
  const { stats, statsLoading, categories } = useTrainingData(settings.verifiedOnly);
  const { exportDataset, isExporting } = useTrainingExport(settings.values);
  const manifest = useTrainingManifest(settings.values);

  const hasAnnotations = Boolean(stats?.totalAnnotations);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{t("header.title")}</h1>
        <Badge variant="outline" className="ml-2">
          {t("header.badge")}
        </Badge>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="mb-4">
          <p className="text-muted-foreground">{t("header.subtitle")}</p>
        </div>

        <TrainingStatsGrid
          stats={stats}
          isLoading={statsLoading}
          splitRatio={settings.values.splitRatio}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <ExportFormatCard selected={settings.format} onSelect={settings.setFormat} />

          <ExportSettingsCard
            settings={settings}
            categories={categories}
            hasAnnotations={hasAnnotations}
            manifest={manifest}
          />
        </div>

        <ExportActionCard
          format={settings.format}
          stats={stats}
          statsLoading={statsLoading}
          includeImages={settings.includeImages}
          isExporting={isExporting}
          onExport={exportDataset}
        />
      </main>
    </div>
  );
}
