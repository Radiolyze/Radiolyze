import { Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SyncOptions } from '@/types/viewerSync';

interface ComparisonSyncIndicatorProps {
  isVisible: boolean;
  syncOptions: SyncOptions;
}

export function ComparisonSyncIndicator({ isVisible, syncOptions }: ComparisonSyncIndicatorProps) {
  if (!isVisible) {
    return null;
  }

  const labels = [
    syncOptions.frames && 'Frames',
    syncOptions.zoom && 'Zoom',
    syncOptions.pan && 'Pan',
    syncOptions.windowLevel && 'WL',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
      <Badge variant="outline" className="bg-card/90 backdrop-blur-sm gap-1">
        <Link2 className="h-3 w-3" />
        {labels}
      </Badge>
    </div>
  );
}
