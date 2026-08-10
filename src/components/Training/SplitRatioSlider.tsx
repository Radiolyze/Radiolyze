import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SPLIT_MAX, SPLIT_MIN, SPLIT_STEP } from "@/lib/trainingExport";

interface SplitRatioSliderProps {
  /** Single-element array — the shape the slider reads and writes. */
  value: number[];
  onValueChange: (value: number[]) => void;
}

export function SplitRatioSlider({ value, onValueChange }: SplitRatioSliderProps) {
  const { t } = useTranslation("training");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{t("stats.split")}</Label>
        <span className="text-sm font-medium">
          {Math.round(value[0] * 100)}% / {Math.round((1 - value[0]) * 100)}%
        </span>
      </div>
      <Slider
        value={value}
        onValueChange={onValueChange}
        min={SPLIT_MIN}
        max={SPLIT_MAX}
        step={SPLIT_STEP}
        className="w-full"
      />
      {/* Labelled from the same constants the slider is bounded by, so the two
          cannot drift apart. */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{t("settings.splitBound", { percent: Math.round(SPLIT_MIN * 100) })}</span>
        <span>{t("settings.splitBound", { percent: Math.round(SPLIT_MAX * 100) })}</span>
      </div>
    </div>
  );
}
