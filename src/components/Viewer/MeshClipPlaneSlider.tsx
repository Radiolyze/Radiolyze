import { useTranslation } from "react-i18next";
import type { ClipAxis } from "@/hooks/useMeshScene";
import { Slider } from "@/components/ui/slider";

interface MeshClipPlaneSliderProps {
  axis: ClipAxis;
  range: [number, number];
  /** `null` before the plane has been centred; falls back to the midpoint. */
  position: number | null;
  onChange: (value: number) => void;
}

/** Slides the active clipping plane along its axis, in millimetres. */
export function MeshClipPlaneSlider({ axis, range, position, onChange }: MeshClipPlaneSliderProps) {
  const { t } = useTranslation("viewer");

  const value = position ?? (range[0] + range[1]) / 2;
  const label = t("mesh.clipPlane.position", { axis: axis.toUpperCase() });
  // A degenerate range (a single loaded actor with no depth) would give a step
  // of 0, which Radix rejects.
  const step = (range[1] - range[0]) / 200 || 1;

  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-md border bg-card/90 px-3 py-2 backdrop-blur">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Slider
        value={[value]}
        min={range[0]}
        max={range[1]}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
        className="w-72"
      />
      <span className="w-14 text-right text-xs tabular-nums">{value.toFixed(1)} mm</span>
    </div>
  );
}
