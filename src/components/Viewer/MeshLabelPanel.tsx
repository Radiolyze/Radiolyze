import { useTranslation } from "react-i18next";
import { ArrowDownAZ, ArrowDownWideNarrow } from "lucide-react";
import type { LabelDisplayState, SegmentationLabel } from "@/types/segmentation";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { MeshLabelRow } from "./MeshLabelRow";
import { defaultLabelState, type SortMode } from "@/lib/meshLabels";

const MIN_VOLUME_SLIDER_MAX_ML = 50;

interface MeshLabelPanelProps {
  labels: SegmentationLabel[];
  /** Total labels in the manifest, for the "shown / total" count. */
  totalLabelCount: number;
  labelStates: Record<number, LabelDisplayState>;
  labelErrors: Record<number, string>;
  /** Large manifests get the search box and minimum-volume slider. */
  showFilters: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  minVolumeMl: number;
  onMinVolumeChange: (value: number) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  onToggleLabel: (label: SegmentationLabel, visible: boolean) => void;
  onOpacityChange: (label: SegmentationLabel, opacity: number) => void;
  onColorChange: (label: SegmentationLabel, rgb: [number, number, number]) => void;
  onColorReset: (label: SegmentationLabel) => void;
  onRetryLabel: (label: SegmentationLabel) => void;
}

/** The right-hand rail listing every segmented organ, with its filters. */
export function MeshLabelPanel({
  labels,
  totalLabelCount,
  labelStates,
  labelErrors,
  showFilters,
  search,
  onSearchChange,
  minVolumeMl,
  onMinVolumeChange,
  sortMode,
  onSortModeChange,
  onToggleLabel,
  onOpacityChange,
  onColorChange,
  onColorReset,
  onRetryLabel,
}: MeshLabelPanelProps) {
  const { t } = useTranslation("viewer");

  return (
    <div className="absolute top-12 right-4 z-20 flex max-h-[85%] w-80 flex-col gap-2 rounded-md border bg-card/90 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">
          {t("mesh.labels")}{" "}
          <span className="font-normal normal-case text-muted-foreground/70">
            {labels.length}/{totalLabelCount}
          </span>
        </h3>
        <Toggle
          size="sm"
          variant="outline"
          pressed={sortMode === "name"}
          onPressedChange={(pressed) => onSortModeChange(pressed ? "name" : "volume")}
          aria-label={t("mesh.sort.toggle")}
          title={sortMode === "name" ? t("mesh.sort.byName") : t("mesh.sort.byVolume")}
        >
          {sortMode === "name" ? (
            <ArrowDownAZ className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
          )}
        </Toggle>
      </div>

      {showFilters && (
        <>
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("mesh.search")}
            className="h-7 text-xs"
            aria-label={t("mesh.search")}
          />
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="shrink-0">{t("mesh.minVolume")}</span>
            <Slider
              value={[minVolumeMl]}
              min={0}
              max={MIN_VOLUME_SLIDER_MAX_ML}
              step={1}
              onValueChange={([v]) => onMinVolumeChange(v)}
              aria-label={t("mesh.minVolume")}
              className="flex-1"
            />
            <span className="w-10 text-right tabular-nums">{minVolumeMl} ml</span>
          </div>
        </>
      )}

      <ul className="space-y-3 overflow-y-auto pr-1">
        {labels.map((label) => (
          <MeshLabelRow
            key={label.id}
            label={label}
            state={labelStates[label.id] ?? defaultLabelState(label, { visible: false })}
            error={labelErrors[label.id]}
            onToggle={(visible) => onToggleLabel(label, visible)}
            onOpacityChange={(opacity) => onOpacityChange(label, opacity)}
            onColorChange={(rgb) => onColorChange(label, rgb)}
            onColorReset={() => onColorReset(label)}
            onRetry={() => onRetryLabel(label)}
          />
        ))}
        {labels.length === 0 && (
          <li className="text-xs text-muted-foreground">{t("mesh.noResults")}</li>
        )}
      </ul>
    </div>
  );
}
