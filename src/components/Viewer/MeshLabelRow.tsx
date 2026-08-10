import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type { LabelDisplayState, SegmentationLabel } from "@/types/segmentation";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MeshColorPicker } from "./MeshColorPicker";
import { formatLabelName, toCssColor } from "@/lib/meshLabels";

interface MeshLabelRowProps {
  label: SegmentationLabel;
  state: LabelDisplayState;
  /** Mesh-fetch failure for this label, if any; drives the retry button. */
  error?: string;
  onToggle: (visible: boolean) => void;
  onOpacityChange: (opacity: number) => void;
  onColorChange: (rgb: [number, number, number]) => void;
  onColorReset: () => void;
  onRetry: () => void;
}

/**
 * One organ in the label panel: colour swatch, visibility checkbox, volume, and
 * an opacity slider that only exists while the label is visible.
 */
export function MeshLabelRow({
  label,
  state,
  error,
  onToggle,
  onOpacityChange,
  onColorChange,
  onColorReset,
  onRetry,
}: MeshLabelRowProps) {
  const { t } = useTranslation("viewer");

  return (
    <li className="space-y-1">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("mesh.colorPicker.open", { name: label.name })}
              className="h-3 w-3 shrink-0 rounded-sm border ring-offset-background transition-shadow hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ backgroundColor: toCssColor(state.color) }}
            />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60">
            <MeshColorPicker
              currentColor={state.color}
              defaultColor={label.color}
              onChange={onColorChange}
              onReset={onColorReset}
            />
          </PopoverContent>
        </Popover>
        <Checkbox
          id={`mesh-toggle-${label.id}`}
          checked={state.visible}
          onCheckedChange={(checked) => onToggle(checked === true)}
        />
        <label
          htmlFor={`mesh-toggle-${label.id}`}
          className="flex-1 cursor-pointer truncate text-sm leading-none"
          title={label.name}
        >
          {formatLabelName(label.name)}
        </label>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {label.volume_ml.toFixed(0)} ml
        </span>
        {error && (
          <button
            type="button"
            onClick={onRetry}
            aria-label={t("mesh.retryLabel", { name: label.name })}
            title={error}
            className="shrink-0 rounded p-0.5 text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>
      {state.visible && (
        <Slider
          value={[state.opacity]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={([value]) => onOpacityChange(value)}
          aria-label={t("mesh.opacity")}
        />
      )}
    </li>
  );
}
