import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ZoomIn,
  Move,
  Ruler,
  Sun,
  ChevronUp,
  ChevronDown,
  Download,
  Maximize2,
} from 'lucide-react';
import type { Series, QAStatus } from '@/types/radiology';
import { Button } from '@/components/ui/button';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { ImageControls, type ViewerToolConfig } from './ImageControls';
import { ProgressOverlay } from './ProgressOverlay';
import { SeriesStack } from './SeriesStack';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { initCornerstone, cornerstoneToolNames } from '@/services/cornerstone';
import { buildWadorsImageId, orthancClient } from '@/services/orthancClient';
import { Enums, RenderingEngine, imageLoader, type StackViewport } from '@cornerstonejs/core';
import { ToolGroupManager, Enums as ToolEnums, annotation } from '@cornerstonejs/tools';

interface DicomViewerProps {
  series: Series | null;
  onFrameChange?: (frame: number, total: number) => void;
  progress?: ViewerProgress;
}

type Tool = 'zoom' | 'pan' | 'measure' | 'windowLevel';

const tools: ViewerToolConfig[] = [
  { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  { id: 'pan', icon: Move, label: 'Pan', shortcut: 'P' },
  { id: 'measure', icon: Ruler, label: 'Messen', shortcut: 'M' },
  { id: 'windowLevel', icon: Sun, label: 'Fenster/Level', shortcut: 'W' },
];

const windowLevelPresets = [
  { id: 'auto', label: 'Auto' },
  { id: 'ct-soft', label: 'CT Weichteil', windowWidth: 400, windowCenter: 40 },
  { id: 'ct-lung', label: 'CT Lunge', windowWidth: 1500, windowCenter: -600 },
  { id: 'ct-bone', label: 'CT Knochen', windowWidth: 2500, windowCenter: 480 },
  { id: 'ct-brain', label: 'CT Gehirn', windowWidth: 80, windowCenter: 40 },
  { id: 'ct-abdomen', label: 'CT Abdomen', windowWidth: 350, windowCenter: 50 },
];

type ASRStatus = 'idle' | 'listening' | 'processing';
type AIStatus = 'idle' | 'generating' | 'error';

export interface ViewerProgress {
  asrStatus: ASRStatus;
  asrConfidence?: number;
  aiStatus: AIStatus;
  qaStatus: QAStatus;
}

type InstanceInfo = {
  instanceId: string;
  frames: number;
  instanceNumber?: number;
};

const getTagValue = (entry: Record<string, unknown>, tag: string) => {
  const tagEntry = entry[tag] as { Value?: unknown[] } | undefined;
  if (tagEntry && Array.isArray(tagEntry.Value) && tagEntry.Value.length > 0) {
    return tagEntry.Value[0];
  }
  return undefined;
};

const getInstanceInfo = (entry: unknown): InstanceInfo | null => {
  if (typeof entry === 'string') {
    return { instanceId: entry, frames: 1 };
  }

  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const instanceId =
    (getTagValue(record, '00080018') as string | undefined) ||
    (record.SOPInstanceUID as string | undefined) ||
    (record.instanceId as string | undefined) ||
    (record.id as string | undefined) ||
    (record.ID as string | undefined);

  if (!instanceId) {
    return null;
  }

  const rawFrames =
    getTagValue(record, '00280008') ||
    record.numberOfFrames ||
    record.NumberOfFrames;
  const parsedFrames = Number(rawFrames);
  const frames = Number.isFinite(parsedFrames) && parsedFrames > 1 ? parsedFrames : 1;

  const rawInstanceNumber =
    getTagValue(record, '00200013') ||
    record.InstanceNumber;
  const parsedInstanceNumber = Number(rawInstanceNumber);

  return {
    instanceId,
    frames,
    instanceNumber: Number.isFinite(parsedInstanceNumber) ? parsedInstanceNumber : undefined,
  };
};

export function DicomViewer({ series, onFrameChange, progress }: DicomViewerProps) {
  const { preferences } = useUserPreferences();
  const [currentFrame, setCurrentFrame] = useState(0);
  const [activeTool, setActiveTool] = useState<Tool>(preferences.defaultTool as Tool);
  const [zoom, setZoom] = useState(1);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFetchingInstances, setIsFetchingInstances] = useState(false);
  const [isInitializingViewer, setIsInitializingViewer] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState(windowLevelPresets[0].id);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const stackViewportRef = useRef<StackViewport | null>(null);
  const toolGroupRef = useRef<ReturnType<typeof ToolGroupManager.getToolGroup> | null>(null);
  const initialParallelScaleRef = useRef<number | null>(null);
  const activeToolRef = useRef<Tool>(activeTool);
  const prefetchTimeoutRef = useRef<number | null>(null);

  const viewerInstanceId = useMemo(
    () => `dicom-viewer-${Math.random().toString(36).slice(2, 9)}`,
    []
  );
  const renderingEngineId = `${viewerInstanceId}-engine`;
  const viewportId = `${viewerInstanceId}-viewport`;
  const toolGroupId = `${viewerInstanceId}-tools`;

  const hasStack = imageIds.length > 0;
  const totalFrames = hasStack ? imageIds.length : series?.frameCount || 1;
  const isLoading = isFetchingInstances || isInitializingViewer;

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    if (!hasStack) {
      return;
    }

    if (prefetchTimeoutRef.current !== null) {
      clearTimeout(prefetchTimeoutRef.current);
    }

    prefetchTimeoutRef.current = window.setTimeout(() => {
      const radius = Math.min(6, Math.max(2, Math.floor(totalFrames / 20)));
      const start = Math.max(0, currentFrame - radius);
      const end = Math.min(totalFrames - 1, currentFrame + radius);
      const prefetchIds: string[] = [];

      for (let index = start; index <= end; index += 1) {
        if (index === currentFrame) continue;
        const imageId = imageIds[index];
        if (imageId) {
          prefetchIds.push(imageId);
        }
      }

      if (prefetchIds.length === 0) {
        return;
      }

      prefetchIds.forEach((imageId) => {
        imageLoader
          .loadAndCacheImage(imageId, {
            requestType: Enums.RequestType.Prefetch,
            priority: 0,
          })
          .catch(() => {
            // Ignore prefetch failures to keep UI responsive.
          });
      });
    }, 150);

    return () => {
      if (prefetchTimeoutRef.current !== null) {
        clearTimeout(prefetchTimeoutRef.current);
        prefetchTimeoutRef.current = null;
      }
    };
  }, [currentFrame, hasStack, imageIds, totalFrames]);

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

    const annotationTools = [cornerstoneToolNames.length];
    const annotations = annotationTools.flatMap((toolName) => {
      const toolAnnotations = annotation.state.getAnnotations(toolName, element) ?? [];
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
  }, [series]);

  // Load DICOM image IDs when series changes
  useEffect(() => {
    if (!series) {
      setImageIds([]);
      setLoadError(null);
      setCurrentFrame(0);
      return;
    }

    let isActive = true;

    const loadInstances = async () => {
      setIsFetchingInstances(true);
      setLoadError(null);
      setImageIds([]);
      setCurrentFrame(0);
      setZoom(1);

      try {
        const response = await orthancClient.listInstances(series.studyId, series.id);
        const rawInstances = Array.isArray(response)
          ? response
          : Array.isArray((response as { Instances?: unknown[] }).Instances)
            ? (response as { Instances: unknown[] }).Instances
            : [];
        const parsed = rawInstances
          .map(getInstanceInfo)
          .filter((item): item is InstanceInfo => Boolean(item));

        if (parsed.length === 0) {
          throw new Error('Keine DICOM Instanzen gefunden');
        }

        parsed.sort((a, b) => {
          if (a.instanceNumber === undefined || b.instanceNumber === undefined) {
            return 0;
          }
          return a.instanceNumber - b.instanceNumber;
        });

        const ids = parsed.flatMap((instance) =>
          Array.from({ length: instance.frames }, (_, index) =>
            buildWadorsImageId(series.studyId, series.id, instance.instanceId, index + 1)
          )
        );

        if (isActive) {
          setImageIds(ids);
        }
      } catch (error) {
        console.warn('Failed to load DICOM instances', error);
        if (isActive) {
          setLoadError('DICOM-Daten konnten nicht geladen werden.');
          setImageIds([]);
        }
      } finally {
        if (isActive) {
          setIsFetchingInstances(false);
        }
      }
    };

    loadInstances();

    return () => {
      isActive = false;
    };
  }, [series]);

  // Initialize Cornerstone viewer when image IDs are available
  useEffect(() => {
    if (!viewportRef.current || imageIds.length === 0) {
      return;
    }

    let isActive = true;
    const element = viewportRef.current;
    const handleStackNewImage = (event: Event) => {
      const detail = (event as CustomEvent<{ imageIdIndex?: number }>).detail;
      if (detail && typeof detail.imageIdIndex === 'number') {
        setCurrentFrame(detail.imageIdIndex);
      }
    };

    const handleCameraModified = (event: Event) => {
      const detail = (event as CustomEvent<{ camera?: { parallelScale?: number } }>).detail;
      const initialScale = initialParallelScaleRef.current;
      const currentScale = detail?.camera?.parallelScale;
      if (initialScale && currentScale) {
        const nextZoom = initialScale / currentScale;
        if (Number.isFinite(nextZoom)) {
          setZoom(nextZoom);
        }
      }
    };

    element.addEventListener(Enums.Events.STACK_NEW_IMAGE, handleStackNewImage);
    element.addEventListener(Enums.Events.CAMERA_MODIFIED, handleCameraModified);

    const setupViewer = async () => {
      setIsInitializingViewer(true);
      setLoadError(null);

      try {
        initCornerstone();

        const renderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngineRef.current = renderingEngine;

        renderingEngine.enableElement({
          viewportId,
          type: Enums.ViewportType.STACK,
          element: viewportRef.current!,
        });

        const viewport = renderingEngine.getViewport(viewportId) as StackViewport;
        stackViewportRef.current = viewport;

        const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
        toolGroupRef.current = toolGroup;

        toolGroup.addTool(cornerstoneToolNames.stackScroll);
        toolGroup.addTool(cornerstoneToolNames.pan);
        toolGroup.addTool(cornerstoneToolNames.zoom);
        toolGroup.addTool(cornerstoneToolNames.windowLevel);
        toolGroup.addTool(cornerstoneToolNames.length);

        toolGroup.addViewport(viewportId, renderingEngineId);
        applyToolSelection(activeToolRef.current);

        await viewport.setStack(imageIds, 0);
        viewport.render();

        applyWindowLevelPreset(selectedPresetId);

        const camera = viewport.getCamera();
        initialParallelScaleRef.current = camera?.parallelScale ?? null;
      } catch (error) {
        console.warn('Cornerstone initialization failed', error);
        if (isActive) {
          setLoadError('Viewer konnte nicht initialisiert werden.');
          setImageIds([]);
        }
      } finally {
        if (isActive) {
          setIsInitializingViewer(false);
        }
      }
    };

    setupViewer();

    return () => {
      isActive = false;
      element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, handleStackNewImage);
      element.removeEventListener(Enums.Events.CAMERA_MODIFIED, handleCameraModified);

      ToolGroupManager.destroyToolGroup(toolGroupId);

      if (renderingEngineRef.current) {
        renderingEngineRef.current.disableElement(viewportId);
        renderingEngineRef.current.destroy();
      }

      renderingEngineRef.current = null;
      stackViewportRef.current = null;
      toolGroupRef.current = null;
      initialParallelScaleRef.current = null;
    };
  }, [applyToolSelection, imageIds, renderingEngineId, toolGroupId, viewportId]);

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
          tools={tools}
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

        {(loadError || imageIds.length === 0) && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground space-y-2">
              <Maximize2 className="h-12 w-12 mx-auto opacity-50" />
              <p>{loadError ?? 'Keine DICOM-Bilder geladen'}</p>
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
