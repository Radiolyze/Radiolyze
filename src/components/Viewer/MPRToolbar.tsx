import { useTranslation } from 'react-i18next';
import { 
  Move, 
  ZoomIn, 
  Sun, 
  Crosshair, 
  RotateCcw,
  Maximize2,
  Grid2X2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { MPROrientation } from '@/types/mpr';
import type { WindowLevelPreset } from '@/config/viewer';

export type MPRToolId = 'crosshairs' | 'pan' | 'zoom' | 'windowLevel';

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
}

const tools: { id: MPRToolId; icon: typeof Crosshair; label: string; shortcut?: string }[] = [
  { id: 'crosshairs', icon: Crosshair, label: 'Crosshairs', shortcut: 'C' },
  { id: 'pan', icon: Move, label: 'Pan', shortcut: 'P' },
  { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  { id: 'windowLevel', icon: Sun, label: 'Fenster/Level', shortcut: 'W' },
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
}: MPRToolbarProps) {
  const { t } = useTranslation('viewer');

  return (
    <div className="flex items-center gap-2 p-2 bg-card/90 backdrop-blur-sm border-b border-border">
      {/* Tool buttons */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {tools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8',
                  activeTool === tool.id && 'bg-primary text-primary-foreground'
                )}
                onClick={() => onToolSelect(tool.id)}
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
          <SelectValue placeholder="W/L Preset" />
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

      {/* Layout controls */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMaximize(isMaximized ? null : activeViewport)}
            disabled={!activeViewport && !isMaximized}
          >
            {isMaximized ? (
              <Grid2X2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isMaximized ? 'Alle Ansichten' : 'Maximieren'}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onReset}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t('tools.reset')} (R)
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
