import { useTranslation } from 'react-i18next';
import { Columns2 } from 'lucide-react';
import type { ImageRef, Series } from '@/types/radiology';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DicomViewer, type ViewerProgress } from './DicomViewer';

interface ComparisonSingleViewProps {
  currentSeries: Series | null;
  progress?: ViewerProgress;
  onFrameChange?: (frame: number, total: number) => void;
  onImageRefsChange?: (refs: ImageRef[]) => void;
  evidenceSelection?: { seriesId: string; stackIndex: number } | null;
  priorStudiesCount: number;
  onEnableCompare: () => void;
}

export function ComparisonSingleView({
  currentSeries,
  progress,
  onFrameChange,
  onImageRefsChange,
  evidenceSelection,
  priorStudiesCount,
  onEnableCompare,
}: ComparisonSingleViewProps) {
  const { t } = useTranslation('viewer');

  const requestedFrameIndex =
    evidenceSelection && currentSeries?.id === evidenceSelection.seriesId
      ? evidenceSelection.stackIndex
      : null;
  const showToggle = priorStudiesCount > 0 && currentSeries;

  return (
    <div className="h-full relative">
      <DicomViewer
        series={currentSeries}
        progress={progress}
        onFrameChange={onFrameChange}
        onImageRefsChange={onImageRefsChange}
        requestedFrameIndex={requestedFrameIndex}
      />

      {/* Compare Mode Toggle */}
      {showToggle && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <Button
            variant="outline"
            size="sm"
            onClick={onEnableCompare}
            className="bg-card/90 backdrop-blur-sm"
          >
            <Columns2 className="h-4 w-4 mr-2" />
            {t('comparison.enable')}
            <Badge variant="secondary" className="ml-2">
              {priorStudiesCount}
            </Badge>
          </Button>
        </div>
      )}
    </div>
  );
}
