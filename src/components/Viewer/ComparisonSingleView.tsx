import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Columns2, Box, View, Boxes } from 'lucide-react';
import type { FindingBox, ImageRef, Series } from '@/types/radiology';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DicomViewer, type ViewerProgress } from './DicomViewer';
import { MPRViewer } from './MPRViewer';
import { VRTViewer } from './VRTViewer';
import { MeshViewer } from './MeshViewer';

export type ViewerMode = 'stack' | 'mpr' | 'vrt' | 'mesh';

interface ComparisonSingleViewProps {
  currentSeries: Series | null;
  progress?: ViewerProgress;
  onFrameChange?: (frame: number, total: number) => void;
  onImageRefsChange?: (refs: ImageRef[]) => void;
  evidenceSelection?: { seriesId: string; stackIndex: number } | null;
  priorStudiesCount: number;
  onEnableCompare: () => void;
  /** AI-detected bounding-box findings to overlay on the image */
  findings?: FindingBox[];
  /** Callback to analyze current frame (on-demand localization) */
  onAnalyzeFrame?: (imageRef: ImageRef) => Promise<void>;
  /** Whether frame analysis is in progress */
  isAnalyzingFrame?: boolean;
  /** StudyInstanceUID required by the segmentation backend */
  studyUid?: string | null;
}

export function ComparisonSingleView({
  currentSeries,
  progress,
  onFrameChange,
  onImageRefsChange,
  evidenceSelection,
  priorStudiesCount,
  onEnableCompare,
  findings = [],
  onAnalyzeFrame,
  isAnalyzingFrame = false,
  studyUid,
}: ComparisonSingleViewProps) {
  const { t } = useTranslation('viewer');
  const [viewerMode, setViewerMode] = useState<ViewerMode>('stack');

  const requestedFrameIndex =
    evidenceSelection && currentSeries?.id === evidenceSelection.seriesId
      ? evidenceSelection.stackIndex
      : null;
  const showToggle = priorStudiesCount > 0 && currentSeries;
  
  // Check if series supports MPR/VRT (CT/MR/PT with sufficient frames)
  const supportsVolumeViewer = currentSeries && 
    ['CT', 'MR', 'PT'].includes(currentSeries.modality) && 
    (currentSeries.frameCount || 0) >= 10;

  return (
    <div className="h-full relative">
      {viewerMode === 'stack' && (
        <DicomViewer
          series={currentSeries}
          progress={progress}
          onFrameChange={onFrameChange}
          onImageRefsChange={onImageRefsChange}
          requestedFrameIndex={requestedFrameIndex}
          findings={findings}
          onAnalyzeFrame={onAnalyzeFrame}
          isAnalyzingFrame={isAnalyzingFrame}
        />
      )}
      {viewerMode === 'mpr' && (
        <MPRViewer series={currentSeries} />
      )}
      {viewerMode === 'vrt' && (
        <VRTViewer series={currentSeries} />
      )}
      {viewerMode === 'mesh' && (
        <MeshViewer series={currentSeries} studyUid={studyUid ?? null} />
      )}

      {/* Mode Toggle Buttons */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {/* MPR Toggle */}
        {supportsVolumeViewer && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewerMode === 'mpr' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewerMode(viewerMode === 'mpr' ? 'stack' : 'mpr')}
                className="bg-card/90 backdrop-blur-sm"
              >
                <Box className="h-4 w-4 mr-2" />
                MPR
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {viewerMode === 'mpr' ? 'Stack-Ansicht' : 'Multi-Planar Rekonstruktion'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* VRT 3D Toggle */}
        {supportsVolumeViewer && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewerMode === 'vrt' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewerMode(viewerMode === 'vrt' ? 'stack' : 'vrt')}
                className="bg-card/90 backdrop-blur-sm"
              >
                <View className="h-4 w-4 mr-2" />
                3D
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {viewerMode === 'vrt' ? 'Stack-Ansicht' : '3D Volume Rendering'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Mesh Model Toggle */}
        {supportsVolumeViewer && currentSeries?.modality === 'CT' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewerMode === 'mesh' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewerMode(viewerMode === 'mesh' ? 'stack' : 'mesh')}
                className="bg-card/90 backdrop-blur-sm"
              >
                <Boxes className="h-4 w-4 mr-2" />
                {t('mesh.title')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('mesh.tooltip')}</TooltipContent>
          </Tooltip>
        )}

        {/* Compare Mode Toggle */}
        {showToggle && viewerMode === 'stack' && (
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
        )}
      </div>
    </div>
  );
}
