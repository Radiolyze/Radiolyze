import type { FindingBox, ImageRef, Series } from '@/types/radiology';
import type { ViewerProgress } from './DicomViewer';
import type { ViewportState } from '@/types/viewerSync';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DicomViewer } from './DicomViewer';
import { ViewerEmptyState } from './ViewerEmptyState';

type BadgeVariant = 'primary' | 'secondary';

interface ComparisonPaneProps {
  series: Series | null;
  label?: string;
  date?: string;
  badgeVariant: BadgeVariant;
  progress?: ViewerProgress;
  onFrameChange?: (frame: number, total: number) => void;
  onViewportChange?: (state: Partial<ViewportState>) => void;
  syncState?: Partial<ViewportState>;
  onImageRefsChange?: (refs: ImageRef[]) => void;
  requestedFrameIndex?: number | null;
  emptyMessage: string;
  className?: string;
  /** AI-detected bounding-box findings to overlay on the image */
  findings?: FindingBox[];
}

const badgeClassNameByVariant: Record<BadgeVariant, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
};

export function ComparisonPane({
  series,
  label,
  date,
  badgeVariant,
  progress,
  onFrameChange,
  onViewportChange,
  syncState,
  onImageRefsChange,
  requestedFrameIndex,
  emptyMessage,
  className,
  findings = [],
}: ComparisonPaneProps) {
  return (
    <div className={cn('flex-1 relative', className)}>
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
        <Badge className={badgeClassNameByVariant[badgeVariant]}>
          {label}
          {date && <span className="ml-1 opacity-70">{date}</span>}
        </Badge>
      </div>
      {series ? (
        <DicomViewer
          series={series}
          progress={progress}
          onFrameChange={onFrameChange}
          onViewportChange={onViewportChange}
          syncState={syncState}
          onImageRefsChange={onImageRefsChange}
          requestedFrameIndex={requestedFrameIndex}
          findings={findings}
        />
      ) : (
        <ViewerEmptyState title={emptyMessage} />
      )}
    </div>
  );
}
