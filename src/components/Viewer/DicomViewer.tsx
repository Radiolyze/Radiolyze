import { useState, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  Move,
  Ruler,
  Sun,
  ChevronUp,
  ChevronDown,
  Maximize2,
} from 'lucide-react';
import type { Series, QAStatus } from '@/types/radiology';
import { Button } from '@/components/ui/button';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ImageControls, type ViewerToolConfig } from './ImageControls';
import { ProgressOverlay } from './ProgressOverlay';
import { SeriesStack } from './SeriesStack';

interface DicomViewerProps {
  series: Series | null;
  onFrameChange?: (frame: number, total: number) => void;
  progress?: ViewerProgress;
}

type Tool = 'zoom' | 'pan' | 'measure' | 'windowLevel';

const tools: ViewerToolConfig[] = [
  { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  { id: 'pan', icon: Move, label: 'Pan', shortcut: 'P' },
  { id: 'measure', icon: Ruler, label: 'Messen', shortcut: 'M' },
  { id: 'windowLevel', icon: Sun, label: 'Fenster/Level', shortcut: 'W' },
];

type ASRStatus = 'idle' | 'listening' | 'processing';
type AIStatus = 'idle' | 'generating' | 'error';

export interface ViewerProgress {
  asrStatus: ASRStatus;
  asrConfidence?: number;
  aiStatus: AIStatus;
  qaStatus: QAStatus;
}

export function DicomViewer({ series, onFrameChange, progress }: DicomViewerProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [activeTool, setActiveTool] = useState<Tool>('windowLevel');
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const totalFrames = series?.frameCount || 1;

  // Simulate loading
  useEffect(() => {
    if (series) {
      setIsLoading(true);
      setCurrentFrame(0);
      const timer = setTimeout(() => setIsLoading(false), 800);
      return () => clearTimeout(timer);
    }
  }, [series?.id]);

  // Notify parent of frame changes
  useEffect(() => {
    onFrameChange?.(currentFrame, totalFrames);
  }, [currentFrame, totalFrames, onFrameChange]);

  const handlePrevFrame = useCallback(() => {
    setCurrentFrame(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextFrame = useCallback(() => {
    setCurrentFrame(prev => Math.min(totalFrames - 1, prev + 1));
  }, [totalFrames]);

  const handleReset = useCallback(() => {
    setZoom(1);
    setCurrentFrame(0);
    setActiveTool('windowLevel');
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onPrevFrame: handlePrevFrame,
    onNextFrame: handleNextFrame,
    onZoomTool: () => setActiveTool('zoom'),
    onPanTool: () => setActiveTool('pan'),
    onMeasureTool: () => setActiveTool('measure'),
    onResetView: handleReset,
  });

  // Handle scroll for frame navigation
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handlePrevFrame();
    } else {
      handleNextFrame();
    }
  }, [handlePrevFrame, handleNextFrame]);

  if (!series) {
    return (
      <div className="h-full flex items-center justify-center bg-viewer">
        <div className="text-center text-muted-foreground">
          <Maximize2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Wählen Sie eine Serie aus</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-viewer relative">
      {/* Toolbar */}
      <ImageControls
        tools={tools}
        activeToolId={activeTool}
        onToolSelect={(toolId) => setActiveTool(toolId as Tool)}
        onReset={handleReset}
        className="absolute top-4 left-4 z-10"
      />

      {/* Series Info */}
      <div className="absolute top-4 right-4 z-10 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-border">
        <p className="text-sm font-medium">{series.seriesDescription}</p>
        <p className="text-xs text-muted-foreground">
          {series.modality} • Serie {series.seriesNumber}
        </p>
      </div>

      {progress && (
        <ProgressOverlay
          asrStatus={progress.asrStatus}
          asrConfidence={progress.asrConfidence}
          aiStatus={progress.aiStatus}
          qaStatus={progress.qaStatus}
          className="absolute top-20 right-4 z-10"
        />
      )}

      {/* Main Viewer Area */}
      <div 
        className="flex-1 flex items-center justify-center cursor-crosshair"
        onWheel={handleWheel}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full spinner" />
            <p className="text-muted-foreground">Lade DICOM-Bilder...</p>
          </div>
        ) : (
          <div 
            className="relative transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          >
            {/* Mock DICOM Image - Gradient placeholder */}
            <div className="w-[512px] h-[512px] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-sm relative overflow-hidden">
              {/* Simulated CT scan patterns */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 rounded-full bg-gradient-radial from-gray-600 to-transparent" />
                <div className="absolute top-1/3 left-1/3 w-8 h-8 rounded-full bg-gray-400/50" />
                <div className="absolute bottom-1/3 right-1/3 w-12 h-8 rounded-full bg-gray-500/40 rotate-45" />
              </div>
              
              {/* Grid overlay for medical appearance */}
              <div 
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent)',
                  backgroundSize: '50px 50px',
                }}
              />

              {/* Frame indicator overlay */}
              <div className="absolute top-2 left-2 text-xs text-white/70 font-mono">
                Im: {currentFrame + 1}/{totalFrames}
              </div>
              <div className="absolute top-2 right-2 text-xs text-white/70 font-mono">
                {series.modality}
              </div>
              <div className="absolute bottom-2 left-2 text-xs text-white/70 font-mono">
                W: 400 L: 40
              </div>
              <div className="absolute bottom-2 right-2 text-xs text-white/70 font-mono">
                Zoom: {(zoom * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Frame Navigation */}
      {totalFrames > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-2 border border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePrevFrame}
            disabled={currentFrame === 0}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          
          <div className="min-w-[80px] text-center">
            <span className="text-sm font-mono">
              {currentFrame + 1} / {totalFrames}
            </span>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNextFrame}
            disabled={currentFrame === totalFrames - 1}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {totalFrames > 1 && !isLoading && (
        <SeriesStack
          totalFrames={totalFrames}
          currentFrame={currentFrame}
          onSelectFrame={setCurrentFrame}
          className="absolute bottom-4 left-4 z-10"
        />
      )}

      {/* Scroll hint */}
      {totalFrames > 1 && !isLoading && (
        <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-card/90 backdrop-blur-sm rounded px-2 py-1 border border-border">
          Scrollen oder ↑↓ zum Navigieren
        </div>
      )}
    </div>
  );
}
