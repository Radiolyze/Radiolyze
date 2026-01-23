import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { AIStatus, ImageRef, QAStatus, Series } from '@/types/radiology';
import type { AnnotationToolId, AllToolId } from '@/types/viewer';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useDicomSeriesInstances } from '@/hooks/useDicomSeriesInstances';
import { useCornerstoneStackViewport } from '@/hooks/useCornerstoneStackViewport';
import { useApplyViewportSyncState } from '@/hooks/useApplyViewportSyncState';
import { useStackPrefetch } from '@/hooks/useStackPrefetch';
import { useCornerstoneViewerTools } from '@/hooks/useCornerstoneViewerTools';
import { useStackFrameNavigation } from '@/hooks/useStackFrameNavigation';
import { useCornerstoneStackSetup } from '@/hooks/useCornerstoneStackSetup';
import { useViewerReset } from '@/hooks/useViewerReset';
import { useAnnotationMode } from '@/hooks/useAnnotationMode';
import { ProgressOverlay } from './ProgressOverlay';
import { DicomViewerToolbar } from './DicomViewerToolbar';
import { DicomViewerStateOverlay } from './DicomViewerStateOverlay';
import { DicomViewerFrameOverlays } from './DicomViewerFrameOverlays';
import { ViewerEmptyState } from './ViewerEmptyState';
import { AnnotationPanel } from './AnnotationPanel';
import { AnnotationLabelDialog } from './AnnotationLabelDialog';
import { exportAnnotations } from '@/services/annotations';
import type { ViewportState } from '@/types/viewerSync';
import type { AnnotationCategory, TrainingAnnotation } from '@/types/annotations';
import { viewerTools, annotationTools, windowLevelPresets } from '@/config/viewer';
import type { ViewerToolId } from '@/types/viewer';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

interface DicomViewerProps {
  series: Series | null;
  onFrameChange?: (frame: number, total: number) => void;
  progress?: ViewerProgress;
  /** Callback when viewport state changes (zoom, pan, window/level) */
  onViewportChange?: (state: Partial<ViewportState>) => void;
  /** External viewport state to sync from another viewer */
  syncState?: Partial<ViewportState>;
  onImageRefsChange?: (refs: ImageRef[]) => void;
  requestedFrameIndex?: number | null;
  /** Show annotation panel */
  showAnnotationPanel?: boolean;
}

type Tool = ViewerToolId;

type ASRStatus = 'idle' | 'listening' | 'processing';

export interface ViewerProgress {
  asrStatus: ASRStatus;
  asrConfidence?: number;
  aiStatus: AIStatus;
  qaStatus: QAStatus;
}

export function DicomViewer({ 
  series, 
  onFrameChange, 
  progress, 
  onViewportChange, 
  syncState, 
  onImageRefsChange, 
  requestedFrameIndex,
  showAnnotationPanel = true,
}: DicomViewerProps) {
  const { preferences } = useUserPreferences();
  const [currentFrame, setCurrentFrame] = useState(0);
  const [activeTool, setActiveTool] = useState<AllToolId>(preferences.defaultTool as Tool);
  const [zoom, setZoom] = useState(1);
  const [selectedPresetId, setSelectedPresetId] = useState(windowLevelPresets[0].id);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const {
    imageIds,
    imageRefs,
    isLoading: isFetchingInstances,
    error: loadError,
  } = useDicomSeriesInstances(series);

  const activeToolRef = useRef<AllToolId>(activeTool);

  const viewerInstanceId = useMemo(
    () => `dicom-viewer-${Math.random().toString(36).slice(2, 9)}`,
    []
  );
  const renderingEngineId = `${viewerInstanceId}-engine`;
  const viewportId = `${viewerInstanceId}-viewport`;
  const toolGroupId = `${viewerInstanceId}-tools`;

  const {
    viewportRef,
    stackViewportRef,
    toolGroupRef,
    initialParallelScaleRef,
    syncingRef,
    isInitializing: isInitializingCornerstone,
    isReady: isViewportReady,
  } = useCornerstoneStackViewport({
    isEnabled: Boolean(series),
    renderingEngineId,
    viewportId,
    toolGroupId,
    onFrameIndexChange: setCurrentFrame,
    onZoomChange: setZoom,
    onViewportChange,
    onInitError: setViewerError,
  });

  const { applyToolSelection, applyWindowLevelPreset } = useCornerstoneViewerTools({
    toolGroupRef,
    stackViewportRef,
    presets: windowLevelPresets,
  });

  const { isInitializing: isInitializingStack } = useCornerstoneStackSetup({
    isReady: isViewportReady,
    imageIds,
    stackViewportRef,
    initialParallelScaleRef,
    activeToolRef,
    selectedPresetId,
    applyToolSelection,
    applyWindowLevelPreset,
    onError: setViewerError,
  });

  const hasStack = imageIds.length > 0;
  const totalFrames = hasStack ? imageIds.length : series?.frameCount || 1;
  const isLoading = isFetchingInstances || isInitializingCornerstone || isInitializingStack;
  const effectiveError = viewerError ?? loadError;

  // Get current instance ID from imageRefs
  const currentInstanceId = imageRefs[currentFrame]?.instanceId;

  // Annotation mode
  const {
    isAnnotationMode,
    setIsAnnotationMode,
    activeAnnotationTool,
    setActiveAnnotationTool,
    pendingAnnotation,
    savePendingAnnotation,
    cancelPendingAnnotation,
    annotations,
    isLoading: annotationsLoading,
    refreshAnnotations,
  } = useAnnotationMode({
    studyId: series?.studyId || null,
    seriesId: series?.id || null,
    instanceId: currentInstanceId,
    currentFrameIndex: currentFrame,
    viewportElement: viewportRef.current,
    enabled: hasStack,
  });

  const { setFrameIndex, handlePrevFrame, handleNextFrame } = useStackFrameNavigation({
    currentFrame,
    setCurrentFrame,
    hasStack,
    totalFrames,
    stackViewportRef,
    requestedFrameIndex,
    onFrameChange,
  });

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useStackPrefetch({
    enabled: hasStack,
    imageIds,
    currentFrame,
    totalFrames,
  });

  const handleExportAnnotations = useCallback(() => {
    const element = viewportRef.current;
    if (!element || !series) {
      return;
    }
    exportAnnotations({ element, series });
  }, [series]);

  useEffect(() => {
    setCurrentFrame(0);
    setZoom(1);
    setViewerError(null);
  }, [series?.id]);

  useEffect(() => {
    onImageRefsChange?.(imageRefs);
  }, [imageRefs, onImageRefsChange]);

  // Update active tool bindings
  useEffect(() => {
    applyToolSelection(activeTool);
  }, [activeTool, applyToolSelection]);

  useEffect(() => {
    if (!hasStack) {
      return;
    }
    applyWindowLevelPreset(selectedPresetId);
  }, [applyWindowLevelPreset, hasStack, selectedPresetId]);

  useApplyViewportSyncState({
    syncState,
    stackViewportRef,
    initialParallelScaleRef,
    syncingRef,
  });

  const handleReset = useViewerReset({
    stackViewportRef,
    setActiveTool: setActiveTool as (tool: ViewerToolId) => void,
    defaultPresetId: windowLevelPresets[0].id,
    setSelectedPresetId,
    setFrameIndex,
    setZoom,
  });

  // Handle tool selection (navigation or annotation)
  const handleToolSelect = useCallback((toolId: string) => {
    const isAnnotationTool = annotationTools.some(t => t.id === toolId);
    if (isAnnotationTool) {
      setActiveAnnotationTool(toolId as AnnotationToolId);
      setActiveTool(toolId as AllToolId);
    } else {
      setActiveAnnotationTool(null);
      setActiveTool(toolId as AllToolId);
    }
  }, [setActiveAnnotationTool]);

  // Handle annotation mode toggle
  const handleAnnotationModeToggle = useCallback(() => {
    const newMode = !isAnnotationMode;
    setIsAnnotationMode(newMode);
    if (newMode && annotationTools.length > 0) {
      // Activate first annotation tool
      const firstTool = annotationTools[0].id;
      setActiveAnnotationTool(firstTool);
      setActiveTool(firstTool);
    } else {
      // Revert to navigation tool
      setActiveAnnotationTool(null);
      setActiveTool(preferences.defaultTool as Tool);
    }
  }, [isAnnotationMode, setIsAnnotationMode, setActiveAnnotationTool, preferences.defaultTool]);

  // Handle saving pending annotation
  const handleSaveAnnotation = useCallback(async (label: string, category: AnnotationCategory) => {
    await savePendingAnnotation(label, category);
  }, [savePendingAnnotation]);

  // Handle annotation selection from panel
  const handleAnnotationSelect = useCallback((annotation: TrainingAnnotation) => {
    // Jump to the frame where this annotation is
    if (annotation.frameIndex !== currentFrame) {
      setFrameIndex(annotation.frameIndex);
    }
  }, [currentFrame, setFrameIndex]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onPrevFrame: handlePrevFrame,
    onNextFrame: handleNextFrame,
    onZoomTool: () => handleToolSelect('zoom'),
    onPanTool: () => handleToolSelect('pan'),
    onMeasureTool: () => handleToolSelect('measure'),
    onResetView: handleReset,
  });

  if (!series) {
    return (
      <ViewerEmptyState title="Wählen Sie eine Serie aus" />
    );
  }

  const viewerContent = (
    <div className="h-full flex flex-col bg-viewer relative">
      {/* Toolbar */}
      <DicomViewerToolbar
        tools={viewerTools}
        annotationTools={annotationTools}
        activeToolId={activeTool}
        onToolSelect={handleToolSelect}
        onReset={handleReset}
        presets={windowLevelPresets}
        selectedPresetId={selectedPresetId}
        onPresetChange={setSelectedPresetId}
        onExportAnnotations={handleExportAnnotations}
        hasStack={hasStack}
        annotationMode={isAnnotationMode}
        onAnnotationModeToggle={handleAnnotationModeToggle}
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
      <div className="flex-1 relative bg-viewer">
        <div ref={viewportRef} className="h-full w-full cursor-crosshair" />

        <DicomViewerStateOverlay
          isLoading={isLoading}
          hasStack={hasStack}
          error={effectiveError}
        />
      </div>

      <DicomViewerFrameOverlays
        hasStack={hasStack}
        totalFrames={totalFrames}
        currentFrame={currentFrame}
        zoom={zoom}
        isLoading={isLoading}
        onPrevFrame={handlePrevFrame}
        onNextFrame={handleNextFrame}
        onSelectFrame={setFrameIndex}
      />

      {/* Annotation Label Dialog */}
      <AnnotationLabelDialog
        open={Boolean(pendingAnnotation)}
        onOpenChange={(open) => {
          if (!open) cancelPendingAnnotation();
        }}
        pendingAnnotation={pendingAnnotation}
        onSave={handleSaveAnnotation}
        onCancel={cancelPendingAnnotation}
      />
    </div>
  );

  // If annotation panel is enabled, show it in a resizable layout
  if (showAnnotationPanel && isAnnotationMode) {
    return (
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={75} minSize={50}>
          {viewerContent}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <AnnotationPanel
            studyId={series.studyId}
            seriesId={series.id}
            currentFrameIndex={currentFrame}
            onAnnotationSelect={handleAnnotationSelect}
            className="h-full bg-card border-l border-border"
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return viewerContent;
}
