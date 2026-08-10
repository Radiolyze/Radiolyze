import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { CategoryCount } from "@/services/trainingClient";
import { SPLIT_MAX, SPLIT_MIN } from "@/lib/trainingExport";

interface TrainingExportSettingsProps {
  verifiedOnly: boolean;
  onVerifiedOnlyChange: (verifiedOnly: boolean) => void;
  splitRatio: number[];
  onSplitRatioChange: (splitRatio: number[]) => void;
  categories: CategoryCount[];
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
  onClearCategories: () => void;
  includeImages: boolean;
  onIncludeImagesChange: (includeImages: boolean) => void;
  /** The manifest controls, shown only while images are included. */
  manifestPanel: ReactNode;
}

export function TrainingExportSettings({
  verifiedOnly,
  onVerifiedOnlyChange,
  splitRatio,
  onSplitRatioChange,
  categories,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  includeImages,
  onIncludeImagesChange,
  manifestPanel,
}: TrainingExportSettingsProps) {
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
        {/* Verified Only Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="verified-only">{t("settings.verifiedOnly")}</Label>
            <p className="text-sm text-muted-foreground">{t("settings.verifiedOnlyHint")}</p>
          </div>
          <Switch
            id="verified-only"
            checked={verifiedOnly}
            onCheckedChange={onVerifiedOnlyChange}
          />
        </div>

        {/* Split Ratio Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{t("stats.split")}</Label>
            <span className="text-sm font-medium">
              {Math.round(splitRatio[0] * 100)}% / {Math.round((1 - splitRatio[0]) * 100)}%
            </span>
          </div>
          <Slider
            value={splitRatio}
            onValueChange={onSplitRatioChange}
            min={SPLIT_MIN}
            max={SPLIT_MAX}
            step={0.05}
            className="w-full"
          />
          {/* Labelled from the same bounds the slider is given, so the two
              cannot drift apart. */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("settings.splitBound", { percent: Math.round(SPLIT_MIN * 100) })}</span>
            <span>{t("settings.splitBound", { percent: Math.round(SPLIT_MAX * 100) })}</span>
          </div>
        </div>

        {/* Category Filter */}
        <div className="space-y-3">
          <Label>{t("settings.categories")}</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map(({ category, count }) => (
              <Badge
                key={category}
                variant={selectedCategories.includes(category) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onToggleCategory(category)}
              >
                {category} ({count})
              </Badge>
            ))}
          </div>
          {selectedCategories.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearCategories}>
              {t("settings.resetFilter")}
            </Button>
          )}
        </div>

        {/* Data Capture */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="include-images">{t("dataCapture.includeImages")}</Label>
              <p className="text-sm text-muted-foreground">{t("dataCapture.includeImagesHint")}</p>
            </div>
            <Switch
              id="include-images"
              checked={includeImages}
              onCheckedChange={onIncludeImagesChange}
            />
          </div>

          {includeImages && manifestPanel}
        </div>
      </CardContent>
    </Card>
  );
}
