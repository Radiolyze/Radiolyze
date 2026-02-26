import { Download, Eye, EyeOff, Scan, Tag, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import type { ImageRef } from '@/types/radiology';
import type { ViewerToolConfig, AnnotationToolConfig, AllToolId } from '@/types/viewer';
import type { WindowLevelPreset } from '@/config/viewer';
import { ImageControls } from './ImageControls';
import { cn } from '@/lib/utils';

interface DicomViewerToolbarProps {
  tools: ViewerToolConfig[];
  annotationTools?: AnnotationToolConfig[];
  activeToolId: string;
  onToolSelect: (toolId: string) => void;
  onReset: () => void;
  presets: WindowLevelPreset[];
  selectedPresetId: string;
  onPresetChange: (presetId: string) => void;
  onExportAnnotations: () => void;
  hasStack: boolean;
  annotationMode?: boolean;
  onAnnotationModeToggle?: () => void;
  findingsCount?: number;
  showFindingsOverlay?: boolean;
  onFindingsOverlayToggle?: () => void;
  /** Callback to analyze current frame (on-demand localization) */
  onAnalyzeFrame?: (imageRef: ImageRef) => Promise<void>;
  /** Current frame's image ref for analyze button */
  currentImageRef?: ImageRef | null;
  /** Whether frame analysis is in progress */
  isAnalyzingFrame?: boolean;
}

export function DicomViewerToolbar({
  tools,
  annotationTools = [],
  activeToolId,
  onToolSelect,
  onReset,
  presets,
  selectedPresetId,
  onPresetChange,
  onExportAnnotations,
  hasStack,
  annotationMode = false,
  onAnnotationModeToggle,
  findingsCount = 0,
  showFindingsOverlay = true,
  onFindingsOverlayToggle,
  onAnalyzeFrame,
  currentImageRef,
  isAnalyzingFrame = false,
}: DicomViewerToolbarProps) {
  const { t } = useTranslation('viewer');
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      {/* Navigation tools */}
      <ImageControls
        tools={tools}
        activeToolId={activeToolId}
        onToolSelect={onToolSelect}
        onReset={onReset}
      />

      {/* Annotation mode toggle + tools */}
      {annotationTools.length > 0 && (
        <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-1.5 border border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={annotationMode ? 'default' : 'ghost'}
                size="sm"
                className={cn('h-8 px-2 gap-1.5', annotationMode && 'bg-primary text-primary-foreground')}
                onClick={onAnnotationModeToggle}
              >
                <Tag className="h-4 w-4" />
                {annotationMode ? (
                  <ToggleRight className="h-4 w-4" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {annotationMode ? 'Annotation-Modus aktiv' : 'Annotation-Modus aktivieren'}
            </TooltipContent>
          </Tooltip>

          {annotationMode && (
            <>
              <div className="w-px h-6 bg-border" />
              {annotationTools.map((tool) => (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8',
                        activeToolId === tool.id && 'bg-accent text-accent-foreground'
                      )}
                      onClick={() => onToolSelect(tool.id)}
                      disabled={!hasStack}
                    >
                      <tool.icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {tool.label} {tool.shortcut && `(${tool.shortcut})`}
                  </TooltipContent>
                </Tooltip>
              ))}
            </>
          )}
        </div>
      )}

      {/* Window/Level presets + Export */}
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
        {onAnalyzeFrame && currentImageRef && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 gap-1.5"
                onClick={() => onAnalyzeFrame(currentImageRef)}
                disabled={!hasStack || isAnalyzingFrame}
              >
                <Scan className={cn('h-4 w-4', isAnalyzingFrame && 'animate-pulse')} />
                <span className="text-xs">
                  {isAnalyzingFrame ? t('progress.ai.running') : t('tools.analyzeFrame')}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('tools.analyzeFrameHint')}
            </TooltipContent>
          </Tooltip>
        )}
        {findingsCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showFindingsOverlay ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-8 px-2 gap-1.5 relative',
                  showFindingsOverlay && 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                )}
                onClick={onFindingsOverlayToggle}
              >
                {showFindingsOverlay ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                <span className="text-xs font-mono">{findingsCount}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showFindingsOverlay
                ? `KI-Befunde ausblenden (${findingsCount})`
                : `KI-Befunde einblenden (${findingsCount})`}
            </TooltipContent>
          </Tooltip>
        )}
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
