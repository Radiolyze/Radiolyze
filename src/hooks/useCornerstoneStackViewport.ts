import { useCallback, useEffect, useRef, useState } from 'react';
import { Enums, RenderingEngine, type StackViewport } from '@cornerstonejs/core';
import { ToolGroupManager } from '@cornerstonejs/tools';
import { initCornerstone, cornerstoneToolNames, getCornerstoneInitErrorMessage } from '@/services/cornerstone';
import type { ViewportState } from '@/types/viewerSync';

interface UseCornerstoneStackViewportOptions {
  isEnabled: boolean;
  renderingEngineId: string;
  viewportId: string;
  toolGroupId: string;
  onFrameIndexChange?: (index: number) => void;
  onZoomChange?: (zoom: number) => void;
  onViewportChange?: (state: Partial<ViewportState>) => void;
  onInitError?: (error: string | null) => void;
}

interface UseCornerstoneStackViewportResult {
  viewportRef: React.RefObject<HTMLDivElement>;
  stackViewportRef: React.RefObject<StackViewport | null>;
  toolGroupRef: React.RefObject<ReturnType<typeof ToolGroupManager.getToolGroup> | null>;
  initialParallelScaleRef: React.RefObject<number | null>;
  syncingRef: React.RefObject<boolean>;
  isInitializing: boolean;
  isReady: boolean;
}

export const useCornerstoneStackViewport = ({
  isEnabled,
  renderingEngineId,
  viewportId,
  toolGroupId,
  onFrameIndexChange,
  onZoomChange,
  onViewportChange,
  onInitError,
}: UseCornerstoneStackViewportOptions): UseCornerstoneStackViewportResult => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const stackViewportRef = useRef<StackViewport | null>(null);
  const toolGroupRef = useRef<ReturnType<typeof ToolGroupManager.getToolGroup> | null>(null);
  const initialParallelScaleRef = useRef<number | null>(null);
  const syncingRef = useRef(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const onFrameIndexChangeRef = useRef(onFrameIndexChange);
  const onZoomChangeRef = useRef(onZoomChange);
  const onViewportChangeRef = useRef(onViewportChange);
  const onInitErrorRef = useRef(onInitError);

  useEffect(() => {
    onFrameIndexChangeRef.current = onFrameIndexChange;
  }, [onFrameIndexChange]);

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    onInitErrorRef.current = onInitError;
  }, [onInitError]);

  const handleStackNewImage = useCallback((event: Event) => {
    const detail = (event as CustomEvent<{ imageIdIndex?: number }>).detail;
    if (detail && typeof detail.imageIdIndex === 'number') {
      onFrameIndexChangeRef.current?.(detail.imageIdIndex);
    }
  }, []);

  const handleCameraModified = useCallback((event: Event) => {
    const detail = (event as CustomEvent<{ camera?: { parallelScale?: number; pan?: number[] } }>).detail;
    const initialScale = initialParallelScaleRef.current;
    const currentScale = detail?.camera?.parallelScale;
    const panValues = detail?.camera?.pan;

    if (initialScale && currentScale) {
      const nextZoom = initialScale / currentScale;
      if (Number.isFinite(nextZoom)) {
        onZoomChangeRef.current?.(nextZoom);

        if (!syncingRef.current && onViewportChangeRef.current) {
          const pan = panValues ? { x: panValues[0] || 0, y: panValues[1] || 0 } : { x: 0, y: 0 };
          onViewportChangeRef.current({ zoom: nextZoom, pan });
        }
      }
    }
  }, []);

  const handleVoiModified = useCallback((event: Event) => {
    if (syncingRef.current || !onViewportChangeRef.current) return;

    const detail = (event as CustomEvent<{ range?: { lower: number; upper: number } }>).detail;
    if (detail?.range) {
      const width = detail.range.upper - detail.range.lower;
      const center = detail.range.lower + width / 2;
      onViewportChangeRef.current({ windowLevel: { width, center } });
    }
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!isEnabled || !element) {
      return;
    }

    let isActive = true;

    const setupViewer = async () => {
      setIsInitializing(true);
      onInitErrorRef.current?.(null);

      try {
        await initCornerstone();
        if (!isActive || !viewportRef.current) {
          return;
        }

        const renderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngineRef.current = renderingEngine;

        renderingEngine.enableElement({
          viewportId,
          type: Enums.ViewportType.STACK,
          element: viewportRef.current!,
        });

        const viewport = renderingEngine.getViewport(viewportId) as StackViewport;
        stackViewportRef.current = viewport;
        setIsReady(true);

        const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
        toolGroupRef.current = toolGroup;

        // Navigation tools
        toolGroup.addTool(cornerstoneToolNames.stackScroll);
        toolGroup.addTool(cornerstoneToolNames.pan);
        toolGroup.addTool(cornerstoneToolNames.zoom);
        toolGroup.addTool(cornerstoneToolNames.windowLevel);
        toolGroup.addTool(cornerstoneToolNames.length);
        
        // Annotation tools for training data
        toolGroup.addTool(cornerstoneToolNames.rectangle);
        toolGroup.addTool(cornerstoneToolNames.ellipse);
        toolGroup.addTool(cornerstoneToolNames.freehand);
        toolGroup.addTool(cornerstoneToolNames.bidirectional);
        toolGroup.addTool(cornerstoneToolNames.arrow);

        toolGroup.addViewport(viewportId, renderingEngineId);

        element.addEventListener(Enums.Events.STACK_NEW_IMAGE, handleStackNewImage);
        element.addEventListener(Enums.Events.CAMERA_MODIFIED, handleCameraModified);
        element.addEventListener(Enums.Events.VOI_MODIFIED, handleVoiModified);
      } catch (error) {
        console.warn('Cornerstone initialization failed', error);
        if (isActive) {
          onInitErrorRef.current?.(
            getCornerstoneInitErrorMessage('Viewer konnte nicht initialisiert werden.', error)
          );
        }
      } finally {
        if (isActive) {
          setIsInitializing(false);
        }
      }
    };

    setupViewer();

    return () => {
      isActive = false;

      element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, handleStackNewImage);
      element.removeEventListener(Enums.Events.CAMERA_MODIFIED, handleCameraModified);
      element.removeEventListener(Enums.Events.VOI_MODIFIED, handleVoiModified);

      ToolGroupManager.destroyToolGroup(toolGroupId);

      if (renderingEngineRef.current) {
        renderingEngineRef.current.disableElement(viewportId);
        renderingEngineRef.current.destroy();
      }

      renderingEngineRef.current = null;
      stackViewportRef.current = null;
      toolGroupRef.current = null;
      initialParallelScaleRef.current = null;
      setIsReady(false);
    };
  }, [
    handleCameraModified,
    handleStackNewImage,
    handleVoiModified,
    isEnabled,
    renderingEngineId,
    toolGroupId,
    viewportId,
  ]);

  return {
    viewportRef,
    stackViewportRef,
    toolGroupRef,
    initialParallelScaleRef,
    syncingRef,
    isInitializing,
    isReady,
  };
};
