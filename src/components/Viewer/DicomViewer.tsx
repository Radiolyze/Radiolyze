import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronUp, ChevronDown, Download, Maximize2 } from 'lucide-react';
import type { AIStatus, ImageRef, QAStatus, Series } from '@/types/radiology';
import { Button } from '@/components/ui/button';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useDicomSeriesInstances } from '@/hooks/useDicomSeriesInstances';
import { useCornerstoneStackViewport } from '@/hooks/useCornerstoneStackViewport';
import { useStackPrefetch } from '@/hooks/useStackPrefetch';
import { ImageControls } from './ImageControls';
import { ProgressOverlay } from './ProgressOverlay';
import { SeriesStack } from './SeriesStack';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cornerstoneToolNames } from '@/services/cornerstone';
import { exportAnnotations } from '@/services/annotations';
import { Enums as ToolEnums } from '@cornerstonejs/tools';
import type { ViewportState } from '@/types/viewerSync';
import { viewerTools, windowLevelPresets } from '@/config/viewer';
import type { ViewerToolId } from '@/types/viewer';

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
}

type Tool = ViewerToolId;

type ASRStatus = 'idle' | 'listening' | 'processing';

export interface ViewerProgress {
  asrStatus: ASRStatus;
  asrConfidence?: number;
  aiStatus: AIStatus;
  qaStatus: QAStatus;
}

export function DicomViewer({ series, onFrameChange, progress, onViewportChange, syncState, onImageRefsChange, requestedFrameIndex }: DicomViewerProps) {
  const { preferences } = useUserPreferences();
  const [currentFrame, setCurrentFrame] = useState(0);
  const [activeTool, setActiveTool] = useState<Tool>(preferences.defaultTool as Tool);
  const [zoom, setZoom] = useState(1);
  const [isInitializingViewer, setIsInitializingViewer] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState(windowLevelPresets[0].id);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const {
    imageIds,
    imageRefs,
    isLoading: isFetchingInstances,
    error: loadError,
  } = useDicomSeriesInstances(series);

  const activeToolRef = useRef<Tool>(activeTool);

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

  const hasStack = imageIds.length > 0;
  const totalFrames = hasStack ? imageIds.length : series?.frameCount || 1;
  const isLoading = isFetchingInstances || isInitializingViewer || isInitializingCornerstone;
  const effectiveError = viewerError ?? loadError;

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useStackPrefetch({
    enabled: hasStack,
    imageIds,
    currentFrame,
    totalFrames,
  });

  const setFrameIndex = useCallback(
    (index: number) => {
      if (!hasStack) {
        setCurrentFrame(0);
        return;
      }

      const nextIndex = Math.max(0, Math.min(index, totalFrames - 1));
      setCurrentFrame(nextIndex);

      const viewport = stackViewportRef.current;
      if (viewport) {
        viewport.setImageIdIndex(nextIndex).catch((error) => {
          console.warn('Failed to change frame', error);
        });
      }
    },
    [hasStack, totalFrames]
  );

  const applyToolSelection = useCallback(
    (tool: Tool) => {
      const toolGroup = toolGroupRef.current;
      if (!toolGroup) {
        return;
      }

      const toolNameMap: Record<Tool, string> = {
        zoom: cornerstoneToolNames.zoom,
        pan: cornerstoneToolNames.pan,
        measure: cornerstoneToolNames.length,
        windowLevel: cornerstoneToolNames.windowLevel,
      };

      const selectedTool = toolNameMap[tool];
      Object.values(toolNameMap).forEach((toolName) => {
        if (toolName === selectedTool) {
          toolGroup.setToolActive(toolName, {
            bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
          });
        } else {
          toolGroup.setToolPassive(toolName, { removeAllBindings: true });
        }
      });

      toolGroup.setToolActive(cornerstoneToolNames.stackScroll, {
        bindings: [{ mouseButton: ToolEnums.MouseBindings.Wheel }],
      });
    },
    []
  );

  const applyWindowLevelPreset = useCallback(
    (presetId: string) => {
      const viewport = stackViewportRef.current;
      if (!viewport) {
        return;
      }

      if (presetId === 'auto') {
        viewport.resetProperties();
        viewport.render();
        return;
      }

      const preset = windowLevelPresets.find((item) => item.id === presetId);
      if (!preset || preset.windowWidth === undefined || preset.windowCenter === undefined) {
        return;
      }

      const halfWidth = preset.windowWidth / 2;
      viewport.setProperties({
        voiRange: {
          lower: preset.windowCenter - halfWidth,
          upper: preset.windowCenter + halfWidth,
        },
      });
      viewport.render();
    },
    []
  );

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

  useEffect(() => {
    if (typeof requestedFrameIndex !== 'number') {
      return;
    }
    if (requestedFrameIndex === currentFrame) {
      return;
    }
    setFrameIndex(requestedFrameIndex);
  }, [currentFrame, requestedFrameIndex, setFrameIndex]);

  useEffect(() => {
    const viewport = stackViewportRef.current;
    if (!viewport || imageIds.length === 0) {
      return;
    }

    let isActive = true;

    const setupStack = async () => {
      setIsInitializingViewer(true);
      setViewerError(null);

      try {
        applyToolSelection(activeToolRef.current);
        await viewport.setStack(imageIds, 0);
        viewport.render();

        applyWindowLevelPreset(selectedPresetId);

        const camera = viewport.getCamera();
        if (isActive) {
          initialParallelScaleRef.current = camera?.parallelScale ?? null;
        }
      } catch (error) {
        console.warn('Cornerstone stack setup failed', error);
        if (isActive) {
          setViewerError('Viewer konnte nicht initialisiert werden.');
        }
      } finally {
        if (isActive) {
          setIsInitializingViewer(false);
        }
      }
    };

    setupStack();

    return () => {
      isActive = false;
    };
  }, [applyToolSelection, applyWindowLevelPreset, imageIds, isInitializingCornerstone, selectedPresetId]);

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

  // Notify parent of frame changes
  useEffect(() => {
    onFrameChange?.(currentFrame, totalFrames);
  }, [currentFrame, totalFrames, onFrameChange]);

  // Apply external sync state
  useEffect(() => {
    const viewport = stackViewportRef.current;
    if (!viewport || !syncState) return;

    syncingRef.current = true;

    try {
      const camera = viewport.getCamera();
      const initialScale = initialParallelScaleRef.current;
      let needsRender = false;

      // Apply zoom
      if (syncState.zoom !== undefined && initialScale) {
        const targetParallelScale = initialScale / syncState.zoom;
        if (camera.parallelScale !== targetParallelScale) {
          viewport.setCamera({ ...camera, parallelScale: targetParallelScale });
          needsRender = true;
        }
      }

      // Apply pan using panWorld method (Cornerstone3D approach)
      if (syncState.pan !== undefined) {
        // Pan is applied via camera focal point offset - we use viewport methods
        // For stack viewports, pan is controlled via the camera's focalPoint
        const worldDelta: [number, number, number] = [syncState.pan.x, syncState.pan.y, 0];
        viewport.setCamera({ 
          ...camera, 
          focalPoint: [
            (camera.focalPoint?.[0] ?? 0) + worldDelta[0],
            (camera.focalPoint?.[1] ?? 0) + worldDelta[1],
            camera.focalPoint?.[2] ?? 0
          ] as [number, number, number]
        });
        needsRender = true;
      }

      // Apply window/level
      if (syncState.windowLevel !== undefined) {
        const halfWidth = syncState.windowLevel.width / 2;
        viewport.setProperties({
          voiRange: {
            lower: syncState.windowLevel.center - halfWidth,
            upper: syncState.windowLevel.center + halfWidth,
          },
        });
        needsRender = true;
      }

      if (needsRender) {
        viewport.render();
      }
    } finally {
      // Reset flag after a small delay to allow events to settle
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    }
  }, [syncState]);

  const handlePrevFrame = useCallback(() => {
    setFrameIndex(currentFrame - 1);
  }, [currentFrame, setFrameIndex]);

  const handleNextFrame = useCallback(() => {
    setFrameIndex(currentFrame + 1);
  }, [currentFrame, setFrameIndex]);

  const handleReset = useCallback(() => {
    setActiveTool('windowLevel');
    setSelectedPresetId(windowLevelPresets[0].id);
    setFrameIndex(0);

    const viewport = stackViewportRef.current;
    if (viewport) {
      viewport.resetCamera({ resetPan: true, resetZoom: true, resetToCenter: true });
      viewport.resetProperties();
    }

    setZoom(1);
  }, [setFrameIndex]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onPrevFrame: handlePrevFrame,
    onNextFrame: handleNextFrame,
    onZoomTool: () => setActiveTool('zoom'),
    onPanTool: () => setActiveTool('pan'),
    onMeasureTool: () => setActiveTool('measure'),
    onResetView: handleReset,
  });

  if (!series) {
    return (
      <div className="h-full flex items-center justify-center bg-viewer">
        <div className="text-center text-muted-foreground">
          <Maximize2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Wählen Sie eine Serie aus</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-viewer relative">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <ImageControls
          tools={viewerTools}
          activeToolId={activeTool}
          onToolSelect={(toolId) => setActiveTool(toolId as Tool)}
          onReset={handleReset}
        />
        <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-2 border border-border">
          <Select
            value={selectedPresetId}
            onValueChange={setSelectedPresetId}
            disabled={!hasStack}
          >
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue placeholder="Fenster/Level" />
            </SelectTrigger>
            <SelectContent>
              {windowLevelPresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={handleExportAnnotations}
            disabled={!hasStack}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

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

        {(effectiveError || imageIds.length === 0) && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground space-y-2">
              <Maximize2 className="h-12 w-12 mx-auto opacity-50" />
              <p>{effectiveError ?? 'Keine DICOM-Bilder geladen'}</p>
              <p className="text-xs text-muted-foreground">
                Prüfen Sie DICOMweb-Verbindung und Serien-ID.
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-viewer/80">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full spinner" />
              <p className="text-muted-foreground">Lade DICOM-Bilder...</p>
            </div>
          </div>
        )}

        {hasStack && (
          <>
            <div className="absolute bottom-2 left-2 text-xs text-white/70 font-mono">
              Im: {currentFrame + 1}/{totalFrames}
            </div>
            <div className="absolute bottom-2 right-2 text-xs text-white/70 font-mono">
              Zoom: {(zoom * 100).toFixed(0)}%
            </div>
          </>
        )}
      </div>

      {/* Frame Navigation */}
      {hasStack && totalFrames > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-2 border border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePrevFrame}
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
            onClick={handleNextFrame}
            disabled={currentFrame === totalFrames - 1}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {hasStack && totalFrames > 1 && !isLoading && (
        <SeriesStack
          totalFrames={totalFrames}
          currentFrame={currentFrame}
          onSelectFrame={setFrameIndex}
          className="absolute bottom-4 left-4 z-10"
        />
      )}

      {/* Scroll hint */}
      {hasStack && totalFrames > 1 && !isLoading && (
        <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-card/90 backdrop-blur-sm rounded px-2 py-1 border border-border">
          Scrollen oder ↑↓ zum Navigieren
        </div>
      )}
    </div>
  );
}
