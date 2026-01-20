import { cn } from '@/lib/utils';

interface SeriesStackProps {
  totalFrames: number;
  currentFrame: number;
  onSelectFrame: (frame: number) => void;
  maxThumbnails?: number;
  className?: string;
}

export function SeriesStack({
  totalFrames,
  currentFrame,
  onSelectFrame,
  maxThumbnails = 10,
  className,
}: SeriesStackProps) {
  const visibleFrames = Math.min(totalFrames, maxThumbnails);
  const frameIndexes = Array.from({ length: visibleFrames }, (_, idx) => {
    if (totalFrames <= maxThumbnails) {
      return idx;
    }

    const step = Math.max(1, Math.floor(totalFrames / maxThumbnails));
    return Math.min(totalFrames - 1, idx * step);
  });

  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2',
        className
      )}
    >
      {frameIndexes.map((frame) => (
        <button
          key={frame}
          onClick={() => onSelectFrame(frame)}
          className={cn(
            'h-12 w-10 rounded border border-border bg-panel-secondary/70 text-[10px] text-muted-foreground',
            'hover:border-primary hover:text-foreground transition-colors',
            frame === currentFrame && 'border-primary text-foreground bg-primary/20'
          )}
          title={`Frame ${frame + 1}`}
        >
          {frame + 1}
        </button>
      ))}
      {totalFrames > maxThumbnails && (
        <div className="text-[10px] text-muted-foreground px-1">+{totalFrames - visibleFrames}</div>
      )}
    </div>
  );
}
