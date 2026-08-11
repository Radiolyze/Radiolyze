import { useTranslation } from "react-i18next";
import { Loader2, RotateCcw, Scissors } from "lucide-react";
import type { SegmentationPreset } from "@/types/segmentation";
import type { ClipAxis } from "@/hooks/useMeshScene";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";

interface MeshViewerToolbarProps {
  preset: SegmentationPreset;
  onPresetChange: (preset: SegmentationPreset) => void;
  onStart: () => void;
  onResetCamera: () => void;
  canStart: boolean;
  isBusy: boolean;
  isFinished: boolean;
  clipEnabled: boolean;
  clipAxis: ClipAxis;
  onClipToggle: (enabled: boolean) => void;
  onClipAxisChange: (axis: ClipAxis) => void;
}

/** Preset picker, job controls and clip-plane switches above the canvas. */
export function MeshViewerToolbar({
  preset,
  onPresetChange,
  onStart,
  onResetCamera,
  canStart,
  isBusy,
  isFinished,
  clipEnabled,
  clipAxis,
  onClipToggle,
  onClipAxisChange,
}: MeshViewerToolbarProps) {
  const { t } = useTranslation("viewer");

  return (
    <div className="absolute top-12 left-4 z-20 flex items-center gap-2 rounded-md border bg-card/90 p-2 backdrop-blur-sm">
      <Select value={preset} onValueChange={(v) => onPresetChange(v as SegmentationPreset)}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="bone">{t("mesh.preset.bone")}</SelectItem>
          <SelectItem value="total">{t("mesh.preset.total")}</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" onClick={onStart} disabled={isBusy || !canStart}>
        {isBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
        {t("mesh.generate")}
      </Button>
      <Button size="sm" variant="outline" onClick={onResetCamera} disabled={!isFinished}>
        <RotateCcw className="h-4 w-4 mr-1" />
        {t("mesh.resetCamera")}
      </Button>
      <div className="ml-1 flex items-center gap-1 border-l pl-2">
        <Toggle
          size="sm"
          variant="outline"
          pressed={clipEnabled}
          onPressedChange={onClipToggle}
          disabled={!isFinished}
          aria-label={t("mesh.clipPlane.toggle")}
          title={t("mesh.clipPlane.toggle")}
        >
          <Scissors className="h-4 w-4" />
        </Toggle>
        {clipEnabled && (
          <Select value={clipAxis} onValueChange={(v) => onClipAxisChange(v as ClipAxis)}>
            <SelectTrigger className="h-8 w-20" aria-label={t("mesh.clipPlane.axis")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="x">{t("mesh.clipPlane.axisX")}</SelectItem>
              <SelectItem value="y">{t("mesh.clipPlane.axisY")}</SelectItem>
              <SelectItem value="z">{t("mesh.clipPlane.axisZ")}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
