import { useTranslation } from "react-i18next";
import { Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CategoryFilter } from "./CategoryFilter";
import { DataCaptureSection } from "./DataCaptureSection";
import { SplitRatioSlider } from "./SplitRatioSlider";
import type { UseExportSettingsReturn } from "@/hooks/training/useExportSettings";
import type { UseTrainingManifestReturn } from "@/hooks/training/useTrainingManifest";
import type { CategoryCount } from "@/services/trainingClient";

interface ExportSettingsCardProps {
  settings: UseExportSettingsReturn;
  categories: CategoryCount[];
  hasAnnotations: boolean;
  manifest: UseTrainingManifestReturn;
}

export function ExportSettingsCard({
  settings,
  categories,
  hasAnnotations,
  manifest,
}: ExportSettingsCardProps) {
  const { t } = useTranslation("training");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          {t("settings.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="verified-only">{t("settings.verifiedOnly")}</Label>
            <p className="text-sm text-muted-foreground">{t("settings.verifiedOnlyHint")}</p>
          </div>
          <Switch
            id="verified-only"
            checked={settings.verifiedOnly}
            onCheckedChange={settings.setVerifiedOnly}
          />
        </div>

        <SplitRatioSlider value={settings.splitRatio} onValueChange={settings.setSplitRatio} />

        <CategoryFilter
          categories={categories}
          selected={settings.categories}
          onToggle={settings.toggleCategory}
          onReset={settings.clearCategories}
        />

        <DataCaptureSection
          includeImages={settings.includeImages}
          onIncludeImagesChange={settings.setIncludeImages}
          hasAnnotations={hasAnnotations}
          manifest={manifest}
        />
      </CardContent>
    </Card>
  );
}
