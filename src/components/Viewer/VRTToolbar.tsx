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
  Settings2,
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
          <span className="text-sm font-medium">{t("vrt.title")}</span>
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Preset Selection */}
        <Select value={settings.presetId} onValueChange={onPresetChange}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t("vrt.presetPlaceholder")} />
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onViewAngle("anterior")}
                aria-label={t("vrt.viewAngles.anterior")}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("vrt.viewAngles.anterior")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onViewAngle("posterior")}
                aria-label={t("vrt.viewAngles.posterior")}
              >
                <Scan className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("vrt.viewAngles.posterior")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onViewAngle("left")}
                aria-label={t("vrt.viewAngles.left")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("vrt.viewAngles.left")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onViewAngle("right")}
                aria-label={t("vrt.viewAngles.right")}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("vrt.viewAngles.right")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onViewAngle("superior")}
                aria-label={t("vrt.viewAngles.superior")}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("vrt.viewAngles.superior")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onViewAngle("inferior")}
                aria-label={t("vrt.viewAngles.inferior")}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("vrt.viewAngles.inferior")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Lighting/Quality Settings */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5">
              <Sun className="h-4 w-4" />
              <span className="text-xs">{t("vrt.lighting.button")}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="font-medium text-sm">{t("vrt.lighting.title")}</div>

              {/* Sample Distance (Quality) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>{t("vrt.lighting.quality")}</span>
                  <span className="text-muted-foreground">
                    {settings.sampleDistance < 0.5
                      ? t("vrt.lighting.qualityHigh")
                      : settings.sampleDistance < 1.5
                        ? t("vrt.lighting.qualityMedium")
                        : t("vrt.lighting.qualityFast")}
                  </span>
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
                  <span>{t("vrt.lighting.ambient")}</span>
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
                  <span>{t("vrt.lighting.diffuse")}</span>
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
                  <span>{t("vrt.lighting.specular")}</span>
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
                  <span>{t("vrt.lighting.specularPower")}</span>
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
