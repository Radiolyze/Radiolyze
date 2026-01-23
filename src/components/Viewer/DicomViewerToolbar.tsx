import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ViewerToolConfig } from '@/types/viewer';
import type { WindowLevelPreset } from '@/config/viewer';
import { ImageControls } from './ImageControls';

interface DicomViewerToolbarProps {
  tools: ViewerToolConfig[];
  activeToolId: string;
  onToolSelect: (toolId: string) => void;
  onReset: () => void;
  presets: WindowLevelPreset[];
  selectedPresetId: string;
  onPresetChange: (presetId: string) => void;
  onExportAnnotations: () => void;
  hasStack: boolean;
}

export function DicomViewerToolbar({
  tools,
  activeToolId,
  onToolSelect,
  onReset,
  presets,
  selectedPresetId,
  onPresetChange,
  onExportAnnotations,
  hasStack,
}: DicomViewerToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <ImageControls
        tools={tools}
        activeToolId={activeToolId}
        onToolSelect={onToolSelect}
        onReset={onReset}
      />
      <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-2 border border-border">
        <Select
          value={selectedPresetId}
          onValueChange={onPresetChange}
          disabled={!hasStack}
        >
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="Fenster/Level" />
          </SelectTrigger>
          <SelectContent>
            {presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={onExportAnnotations}
          disabled={!hasStack}
        >
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>
    </div>
  );
}
