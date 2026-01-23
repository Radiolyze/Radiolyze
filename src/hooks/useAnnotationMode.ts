import { useState, useCallback, useEffect, useRef } from 'react';
import { annotation, Enums as ToolEnums } from '@cornerstonejs/tools';
import type { AnnotationToolId, AllToolId } from '@/types/viewer';
import type { 
  TrainingAnnotation, 
  AnnotationCreateRequest,
  AnnotationToolType,
  AnnotationCategory,
  Point3D,
  BoundingBox,
} from '@/types/annotations';
import { createAnnotation, listAnnotationsForSeries } from '@/services/annotationClient';
import { cornerstoneToolNames } from '@/services/cornerstone';
import { useQueryClient } from '@tanstack/react-query';

interface UseAnnotationModeOptions {
  studyId: string | null;
  seriesId: string | null;
  instanceId?: string;
  currentFrameIndex: number;
  viewportElement: HTMLDivElement | null;
  enabled: boolean;
}

interface UseAnnotationModeReturn {
  isAnnotationMode: boolean;
  setIsAnnotationMode: (value: boolean) => void;
  activeAnnotationTool: AnnotationToolId | null;
  setActiveAnnotationTool: (tool: AnnotationToolId | null) => void;
  pendingAnnotation: Partial<AnnotationCreateRequest> | null;
  setPendingAnnotation: (ann: Partial<AnnotationCreateRequest> | null) => void;
  savePendingAnnotation: (label: string, category: AnnotationCategory) => Promise<TrainingAnnotation | null>;
  cancelPendingAnnotation: () => void;
  annotations: TrainingAnnotation[];
  isLoading: boolean;
  refreshAnnotations: () => void;
}

// Map Cornerstone tool names to our annotation tool types
const toolNameToType: Record<string, AnnotationToolType> = {
  [cornerstoneToolNames.rectangle]: 'rectangle',
  [cornerstoneToolNames.ellipse]: 'ellipse',
  [cornerstoneToolNames.freehand]: 'freehand',
  [cornerstoneToolNames.bidirectional]: 'bidirectional',
  [cornerstoneToolNames.arrow]: 'arrow',
  [cornerstoneToolNames.length]: 'length',
};

// Map our tool IDs to Cornerstone tool names
const annotationToolToCornerstone: Record<AnnotationToolId, string> = {
  rectangle: cornerstoneToolNames.rectangle,
  ellipse: cornerstoneToolNames.ellipse,
  freehand: cornerstoneToolNames.freehand,
  bidirectional: cornerstoneToolNames.bidirectional,
  arrow: cornerstoneToolNames.arrow,
};

export function useAnnotationMode({
  studyId,
  seriesId,
  instanceId,
  currentFrameIndex,
  viewportElement,
  enabled,
}: UseAnnotationModeOptions): UseAnnotationModeReturn {
  const queryClient = useQueryClient();
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [activeAnnotationTool, setActiveAnnotationTool] = useState<AnnotationToolId | null>(null);
  const [pendingAnnotation, setPendingAnnotation] = useState<Partial<AnnotationCreateRequest> | null>(null);
  const [annotations, setAnnotations] = useState<TrainingAnnotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const lastAnnotationUIDRef = useRef<string | null>(null);

  // Load annotations for current series
  const refreshAnnotations = useCallback(async () => {
    if (!studyId || !seriesId) {
      setAnnotations([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await listAnnotationsForSeries(studyId, seriesId);
      setAnnotations(result);
    } catch (error) {
      console.warn('Failed to load annotations:', error);
      setAnnotations([]);
    } finally {
      setIsLoading(false);
    }
  }, [studyId, seriesId]);

  // Load annotations when series changes
  useEffect(() => {
    if (enabled) {
      refreshAnnotations();
    }
  }, [enabled, refreshAnnotations]);

  // Listen for annotation completed events
  useEffect(() => {
    if (!viewportElement || !isAnnotationMode || !enabled) return;

    const handleAnnotationCompleted = (event: CustomEvent) => {
      const { annotation: ann } = event.detail;
      if (!ann || !ann.annotationUID) return;
      
      // Prevent duplicate processing
      if (lastAnnotationUIDRef.current === ann.annotationUID) return;
      lastAnnotationUIDRef.current = ann.annotationUID;

      const toolName = ann.metadata?.toolName || '';
      const toolType = toolNameToType[toolName];
      
      if (!toolType) {
        console.warn('Unknown tool type for annotation:', toolName);
        return;
      }

      // Extract handles/points
      const handles: Point3D[] = [];
      const pointsData = ann.data?.handles?.points || [];
      pointsData.forEach((point: number[]) => {
        if (Array.isArray(point) && point.length >= 2) {
          handles.push({ x: point[0], y: point[1], z: point[2] });
        }
      });

      // Calculate bounding box from handles
      let boundingBox: BoundingBox | undefined;
      if (handles.length >= 2) {
        const xs = handles.map(h => h.x);
        const ys = handles.map(h => h.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        boundingBox = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };
      }

      // Create pending annotation
      setPendingAnnotation({
        studyId: studyId!,
        seriesId: seriesId!,
        instanceId: instanceId || 'unknown',
        frameIndex: currentFrameIndex,
        toolType,
        handles,
        boundingBox,
        cornerstoneAnnotationUID: ann.annotationUID,
      });
    };

    // Subscribe to annotation events
    viewportElement.addEventListener(
      ToolEnums.Events.ANNOTATION_COMPLETED as string,
      handleAnnotationCompleted as EventListener
    );

    return () => {
      viewportElement.removeEventListener(
        ToolEnums.Events.ANNOTATION_COMPLETED as string,
        handleAnnotationCompleted as EventListener
      );
    };
  }, [viewportElement, isAnnotationMode, enabled, studyId, seriesId, instanceId, currentFrameIndex]);

  // Save pending annotation
  const savePendingAnnotation = useCallback(async (
    label: string,
    category: AnnotationCategory
  ): Promise<TrainingAnnotation | null> => {
    if (!pendingAnnotation || !studyId || !seriesId) return null;

    try {
      const request: AnnotationCreateRequest = {
        studyId: pendingAnnotation.studyId || studyId,
        seriesId: pendingAnnotation.seriesId || seriesId,
        instanceId: pendingAnnotation.instanceId || 'unknown',
        frameIndex: pendingAnnotation.frameIndex ?? currentFrameIndex,
        toolType: pendingAnnotation.toolType!,
        handles: pendingAnnotation.handles || [],
        boundingBox: pendingAnnotation.boundingBox,
        label,
        category,
        cornerstoneAnnotationUID: pendingAnnotation.cornerstoneAnnotationUID,
        actorId: 'current-user',
      };

      const saved = await createAnnotation(request);
      setPendingAnnotation(null);
      lastAnnotationUIDRef.current = null;
      
      // Refresh annotations list
      await refreshAnnotations();
      queryClient.invalidateQueries({ queryKey: ['annotations', studyId, seriesId] });
      
      return saved;
    } catch (error) {
      console.error('Failed to save annotation:', error);
      return null;
    }
  }, [pendingAnnotation, studyId, seriesId, currentFrameIndex, refreshAnnotations, queryClient]);

  // Cancel pending annotation
  const cancelPendingAnnotation = useCallback(() => {
    if (pendingAnnotation?.cornerstoneAnnotationUID && viewportElement) {
      // Remove the annotation from Cornerstone
      try {
        const manager = annotation.state.getAnnotationManager();
        manager.removeAnnotation(pendingAnnotation.cornerstoneAnnotationUID);
      } catch (error) {
        console.warn('Failed to remove annotation:', error);
      }
    }
    setPendingAnnotation(null);
    lastAnnotationUIDRef.current = null;
  }, [pendingAnnotation, viewportElement]);

  // Reset state when annotation mode is disabled
  useEffect(() => {
    if (!isAnnotationMode) {
      setActiveAnnotationTool(null);
      if (pendingAnnotation) {
        cancelPendingAnnotation();
      }
    }
  }, [isAnnotationMode, pendingAnnotation, cancelPendingAnnotation]);

  return {
    isAnnotationMode,
    setIsAnnotationMode,
    activeAnnotationTool,
    setActiveAnnotationTool,
    pendingAnnotation,
    setPendingAnnotation,
    savePendingAnnotation,
    cancelPendingAnnotation,
    annotations,
    isLoading,
    refreshAnnotations,
  };
}
