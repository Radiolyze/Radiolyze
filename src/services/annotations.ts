import { annotation } from '@cornerstonejs/tools';
import type { Series } from '@/types/radiology';
import { cornerstoneToolNames } from '@/services/cornerstone';

interface ExportAnnotationsOptions {
  element: HTMLDivElement;
  series: Series;
  toolNames?: string[];
}

export const exportAnnotations = ({
  element,
  series,
  toolNames = [cornerstoneToolNames.length],
}: ExportAnnotationsOptions) => {
  const annotations = toolNames.flatMap((toolName) => {
    const toolAnnotations = annotation.state.getAnnotations(toolName, element as unknown as Parameters<typeof annotation.state.getAnnotations>[1]) ?? [];
    return toolAnnotations.map((item) => ({
      annotationUID: item.annotationUID ?? '',
      toolName,
      label: item.data?.label ?? '',
      handles: item.data?.handles?.points ?? [],
      cachedStats: item.data?.cachedStats ?? {},
      metadata: {
        referencedImageId: item.metadata?.referencedImageId,
        FrameOfReferenceUID: item.metadata?.FrameOfReferenceUID,
        sliceIndex: item.metadata?.sliceIndex,
        viewPlaneNormal: item.metadata?.viewPlaneNormal,
        viewUp: item.metadata?.viewUp,
      },
    }));
  });

  const payload = {
    studyId: series.studyId,
    seriesId: series.id,
    exportedAt: new Date().toISOString(),
    annotations,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `annotations-${series.studyId}-${series.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
};
