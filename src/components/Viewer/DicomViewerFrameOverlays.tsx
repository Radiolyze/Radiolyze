import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SeriesStack } from './SeriesStack';

interface DicomViewerFrameOverlaysProps {
  hasStack: boolean;
  totalFrames: number;
  currentFrame: number;
  zoom: number;
  isLoading: boolean;
  onPrevFrame: () => void;
  onNextFrame: () => void;
  onSelectFrame: (frame: number) => void;
}

export function DicomViewerFrameOverlays({
  hasStack,
  totalFrames,
  currentFrame,
  zoom,
  isLoading,
  onPrevFrame,
  onNextFrame,
  onSelectFrame,
}: DicomViewerFrameOverlaysProps) {
  if (!hasStack) {
    return null;
  }

  return (
    <>
      <div className="absolute bottom-2 left-2 text-xs text-white/70 font-mono">
        Im: {currentFrame + 1}/{totalFrames}
      </div>
      <div className="absolute bottom-2 right-2 text-xs text-white/70 font-mono">
        Zoom: {(zoom * 100).toFixed(0)}%
      </div>

      {totalFrames > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-2 border border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPrevFrame}
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
            onClick={onNextFrame}
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
          onSelectFrame={onSelectFrame}
          className="absolute bottom-4 left-4 z-10"
        />
      )}

      {totalFrames > 1 && !isLoading && (
        <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-card/90 backdrop-blur-sm rounded px-2 py-1 border border-border">
          Scrollen oder ↑↓ zum Navigieren
        </div>
      )}
    </>
  );
}
