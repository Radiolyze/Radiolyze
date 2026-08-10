import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { computeSplitCounts, computeVerifiedPercentage } from "@/lib/trainingExport";
import { useTrainingData } from "@/hooks/useTrainingData";
import { useExportSettings } from "@/hooks/useExportSettings";
import { useTrainingExport } from "@/hooks/useTrainingExport";
import { useTrainingManifest } from "@/hooks/useTrainingManifest";
import { TrainingStatsGrid } from "@/components/Training/TrainingStatsGrid";
import { TrainingFormatSelector } from "@/components/Training/TrainingFormatSelector";
import { TrainingExportSettings } from "@/components/Training/TrainingExportSettings";
import { TrainingManifestPanel } from "@/components/Training/TrainingManifestPanel";
import { TrainingExportAction } from "@/components/Training/TrainingExportAction";

export default function Training() {
  const { t } = useTranslation("training");

  const {
    settings,
    selectedFormat,
    setSelectedFormat,
    verifiedOnly,
    setVerifiedOnly,
    splitRatio,
    setSplitRatio,
    selectedCategories,
    toggleCategory,
    clearCategories,
    includeImages,
    setIncludeImages,
  } = useExportSettings();

  // The stats read is keyed on the verified-only toggle — it changes what the
  // backend counts — so the settings come first and the data follows them.
  const { stats, statsLoading, categories } = useTrainingData(verifiedOnly);

  const { isExporting, runExport } = useTrainingExport(settings);
  const manifest = useTrainingManifest(settings, stats);

  const verifiedPercentage = computeVerifiedPercentage(stats);
  const splitCounts = computeSplitCounts(stats, settings.splitRatio);

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
          statsLoading={statsLoading}
          verifiedPercentage={verifiedPercentage}
          splitCounts={splitCounts}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <TrainingFormatSelector
            selectedFormat={selectedFormat}
            onSelectFormat={setSelectedFormat}
          />

          <TrainingExportSettings
            verifiedOnly={verifiedOnly}
            onVerifiedOnlyChange={setVerifiedOnly}
            splitRatio={splitRatio}
            onSplitRatioChange={setSplitRatio}
            categories={categories}
            selectedCategories={selectedCategories}
            onToggleCategory={toggleCategory}
            onClearCategories={clearCategories}
            includeImages={includeImages}
            onIncludeImagesChange={setIncludeImages}
            manifestPanel={
              <TrainingManifestPanel
                manifest={manifest.manifest}
                isPending={manifest.isPending}
                isDownloading={manifest.isDownloading}
                canGenerate={manifest.canGenerate}
                onGeneratePreview={manifest.generatePreview}
                onCheckImages={manifest.checkImages}
                onDownload={manifest.downloadManifest}
              />
            }
          />
        </div>

        <TrainingExportAction
          stats={stats}
          statsLoading={statsLoading}
          selectedFormat={selectedFormat}
          includeImages={includeImages}
          isExporting={isExporting}
          onExport={runExport}
        />
      </main>
    </div>
  );
}
