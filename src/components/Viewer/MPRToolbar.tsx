import { useTranslation } from "react-i18next";
import { Move, ZoomIn, Sun, Crosshair, RotateCcw, Maximize2, Grid2X2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { MPROrientation, SlabSettings } from "@/types/mpr";
import { SLAB_BLEND_MODES, SLAB_THICKNESS_PRESETS } from "@/types/mpr";
import type { WindowLevelPreset } from "@/config/viewer";

export type MPRToolId = "crosshairs" | "pan" | "zoom" | "windowLevel";

interface MPRToolbarProps {
  activeTool: MPRToolId;
  onToolSelect: (tool: MPRToolId) => void;
  onReset: () => void;
  presets: WindowLevelPreset[];
  selectedPresetId: string;
  onPresetChange: (presetId: string) => void;
  activeViewport: MPROrientation | null;
  onMaximize: (orientation: MPROrientation | null) => void;
  isMaximized: boolean;
  slabSettings: SlabSettings;
  onSlabSettingsChange: (settings: SlabSettings) => void;
}

const tools: { id: MPRToolId; icon: typeof Crosshair; label: string; shortcut?: string }[] = [
  { id: "crosshairs", icon: Crosshair, label: "Crosshairs", shortcut: "C" },
  { id: "pan", icon: Move, label: "Pan", shortcut: "P" },
  { id: "zoom", icon: ZoomIn, label: "Zoom", shortcut: "Z" },
  { id: "windowLevel", icon: Sun, label: "W/L", shortcut: "W" },
];

export function MPRToolbar({
  activeTool,
  onToolSelect,
  onReset,
  presets,
  selectedPresetId,
  onPresetChange,
  activeViewport,
  onMaximize,
  isMaximized,
  slabSettings,
  onSlabSettingsChange,
}: MPRToolbarProps) {
  const { t } = useTranslation("viewer");

  const isSlabActive = slabSettings.thickness > 0;

  return (
    <div className="flex items-center gap-2 p-2 bg-card/90 backdrop-blur-xs border-b border-border">
      {/* Tool buttons */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {tools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  activeTool === tool.id && "bg-primary text-primary-foreground",
                )}
                onClick={() => onToolSelect(tool.id)}
                aria-label={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
              >
                <tool.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {tool.label} {tool.shortcut && `(${tool.shortcut})`}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Window/Level presets */}
      <Select value={selectedPresetId} onValueChange={onPresetChange}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder={t("mpr.windowLevelPreset")} />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-px h-6 bg-border" />

      {/* Slab/MIP Controls */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={isSlabActive ? "default" : "outline"}
            size="sm"
            className={cn("h-8 gap-1.5", isSlabActive && "bg-primary text-primary-foreground")}
          >
            <Layers className="h-4 w-4" />
            {isSlabActive ? (
              <span className="text-xs">
                {t(`mpr.slab.mode.${slabSettings.blendMode}`)} {slabSettings.thickness}mm
              </span>
            ) : (
              <span className="text-xs">{t("mpr.slab.title")}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">{t("mpr.slab.projectionMode")}</Label>
              <div className="flex gap-1">
                {SLAB_BLEND_MODES.map((mode) => (
                  <Button
                    key={mode}
                    variant={slabSettings.blendMode === mode ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => onSlabSettingsChange({ ...slabSettings, blendMode: mode })}
                  >
                    {t(`mpr.slab.mode.${mode}`)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">{t("mpr.slab.thickness")}</Label>
                <span className="text-xs text-muted-foreground">{slabSettings.thickness}mm</span>
              </div>
              <Slider
                value={[slabSettings.thickness]}
                onValueChange={([value]) =>
                  onSlabSettingsChange({ ...slabSettings, thickness: value })
                }
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex gap-1 flex-wrap">
                {SLAB_THICKNESS_PRESETS.map((thickness) => (
                  <Button
                    key={thickness}
                    variant={slabSettings.thickness === thickness ? "secondary" : "ghost"}
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => onSlabSettingsChange({ ...slabSettings, thickness })}
                  >
                    {thickness === 0 ? t("mpr.slab.thin") : `${thickness}mm`}
                  </Button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>MIP:</strong> {t("mpr.slab.help.mip")}
                </p>
                <p>
                  <strong>MinIP:</strong> {t("mpr.slab.help.minip")}
                </p>
                <p>
                  <strong>Average:</strong> {t("mpr.slab.help.average")}
                </p>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="w-px h-6 bg-border" />

      {/* Layout controls */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMaximize(isMaximized ? null : activeViewport)}
            disabled={!activeViewport && !isMaximized}
            aria-label={isMaximized ? t("mpr.showAll") : t("mpr.maximize")}
          >
            {isMaximized ? <Grid2X2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isMaximized ? t("mpr.showAll") : t("mpr.maximize")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onReset}
            aria-label={`${t("tools.reset")} (R)`}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("tools.reset")} (R)</TooltipContent>
      </Tooltip>
    </div>
  );
}
