import { useTranslation } from "react-i18next";
import {
  RotateCcw,
  Box,
  Eye,
  Sun,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Scan,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VRT_PRESETS, type VRTSettings, type VRTViewAngle } from "@/types/vrt";
import { cn } from "@/lib/utils";

/**
 * The six standard views, with the icon and keyboard shortcut each button
 * carries. Labels are resolved per render as `viewer:vrt.viewAngle.<angle>` —
 * "Left"/"Right" are "Links"/"Rechts" in German, and the shortcut letter still
 * matches in both languages.
 */
const VIEW_ANGLE_BUTTONS: { angle: VRTViewAngle; icon: typeof Eye; shortcut: string }[] = [
  { angle: "anterior", icon: Eye, shortcut: "A" },
  { angle: "posterior", icon: Scan, shortcut: "P" },
  { angle: "left", icon: ArrowLeft, shortcut: "L" },
  { angle: "right", icon: ArrowRight, shortcut: "R" },
  { angle: "superior", icon: ArrowUp, shortcut: "S" },
  { angle: "inferior", icon: ArrowDown, shortcut: "I" },
];

interface VRTToolbarProps {
  settings: VRTSettings;
  onSettingsChange: (settings: VRTSettings) => void;
  onPresetChange: (presetId: string) => void;
  onViewAngle: (angle: VRTViewAngle) => void;
  onReset: () => void;
  className?: string;
}

export function VRTToolbar({
  settings,
  onSettingsChange,
  onPresetChange,
  onViewAngle,
  onReset,
  className,
}: VRTToolbarProps) {
  const { t } = useTranslation("viewer");

  const qualityLabel =
    settings.sampleDistance < 0.5
      ? t("vrt.quality.high")
      : settings.sampleDistance < 1.5
        ? t("vrt.quality.medium")
        : t("vrt.quality.fast");

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-card border-b border-border",
          className,
        )}
      >
        {/* 3D Indicator */}
        <div className="flex items-center gap-1.5 text-primary">
          <Box className="h-4 w-4" />
          {/* eslint-disable-next-line i18next/no-literal-string -- "3D VRT" is the rendering mode's product name, identical in every language */}
          <span className="text-sm font-medium">3D VRT</span>
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Preset Selection */}
        <Select value={settings.presetId} onValueChange={onPresetChange}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t("vrt.selectPreset")} />
          </SelectTrigger>
          <SelectContent>
            {VRT_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                <div className="flex flex-col">
                  <span>{preset.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`vrt.presets.${preset.id}`)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-border mx-1" />

        {/* View Angle Buttons */}
        <div className="flex items-center gap-0.5">
          {VIEW_ANGLE_BUTTONS.map(({ angle, icon: Icon, shortcut }) => {
            const label = t("vrt.viewAngleShortcut", {
              name: t(`vrt.viewAngle.${angle}`),
              shortcut,
            });
            return (
              <Tooltip key={angle}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onViewAngle(angle)}
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Lighting/Quality Settings */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5">
              <Sun className="h-4 w-4" />
              <span className="text-xs">{t("vrt.lighting")}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="font-medium text-sm">{t("vrt.renderSettings")}</div>

              {/* Sample Distance (Quality) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>{t("vrt.quality.label")}</span>
                  <span className="text-muted-foreground">{qualityLabel}</span>
                </div>
                <Slider
                  value={[settings.sampleDistance]}
                  onValueChange={([v]) => onSettingsChange({ ...settings, sampleDistance: v })}
                  min={0.2}
                  max={3}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Ambient */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>{t("vrt.ambient")}</span>
                  <span className="text-muted-foreground">
                    {Math.round(settings.ambient * 100)}%
                  </span>
                </div>
                <Slider
                  value={[settings.ambient]}
                  onValueChange={([v]) => onSettingsChange({ ...settings, ambient: v })}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              {/* Diffuse */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>{t("vrt.diffuse")}</span>
                  <span className="text-muted-foreground">
                    {Math.round(settings.diffuse * 100)}%
                  </span>
                </div>
                <Slider
                  value={[settings.diffuse]}
                  onValueChange={([v]) => onSettingsChange({ ...settings, diffuse: v })}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              {/* Specular */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>{t("vrt.specular")}</span>
                  <span className="text-muted-foreground">
                    {Math.round(settings.specular * 100)}%
                  </span>
                </div>
                <Slider
                  value={[settings.specular]}
                  onValueChange={([v]) => onSettingsChange({ ...settings, specular: v })}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              {/* Specular Power */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>{t("vrt.specularPower")}</span>
                  <span className="text-muted-foreground">{settings.specularPower}</span>
                </div>
                <Slider
                  value={[settings.specularPower]}
                  onValueChange={([v]) => onSettingsChange({ ...settings, specularPower: v })}
                  min={1}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Reset */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onReset}
              aria-label={t("vrt.resetCamera")}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("vrt.resetCamera")}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
