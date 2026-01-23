import { useState, useCallback, useMemo, useEffect } from 'react';
import { Loader2, Box } from 'lucide-react';
import type { Series } from '@/types/radiology';
import type { MPROrientation } from '@/types/mpr';
import { MPR_VIEWPORTS } from '@/types/mpr';
import { useDicomSeriesInstances } from '@/hooks/useDicomSeriesInstances';
import { useMPRVolumeViewport } from '@/hooks/useMPRVolumeViewport';
import { MPRViewport } from './MPRViewport';
import { MPRToolbar, type MPRToolId } from './MPRToolbar';
import { ViewerEmptyState } from './ViewerEmptyState';
import { windowLevelPresets } from '@/config/viewer';
import { cn } from '@/lib/utils';

interface MPRViewerProps {
  series: Series | null;
  className?: string;
}

export function MPRViewer({ series, className }: MPRViewerProps) {
  const [activeTool, setActiveTool] = useState<MPRToolId>('crosshairs');
  const [selectedPresetId, setSelectedPresetId] = useState(windowLevelPresets[0].id);
  const [activeViewport, setActiveViewport] = useState<MPROrientation | null>(null);
  const [maximizedViewport, setMaximizedViewport] = useState<MPROrientation | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const {
    imageIds,
    isLoading: isFetchingInstances,
    error: loadError,
  } = useDicomSeriesInstances(series);

  const viewerInstanceId = useMemo(
    () => `mpr-viewer-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  const viewportIds = useMemo(() => ({
    axial: `${viewerInstanceId}-axial`,
    sagittal: `${viewerInstanceId}-sagittal`,
    coronal: `${viewerInstanceId}-coronal`,
  }), [viewerInstanceId]);

  const {
    viewportRefs,
    isInitializing,
    isReady,
    sliceState,
    jumpToSlice,
    slabSettings,
    setSlabSettings,
  } = useMPRVolumeViewport({
    isEnabled: Boolean(series) && imageIds.length > 0,
    imageIds,
    renderingEngineId: `${viewerInstanceId}-engine`,
    viewportIds,
    toolGroupId: `${viewerInstanceId}-tools`,
    onInitError: setViewerError,
  });

  const isLoading = isFetchingInstances || isInitializing;
  const effectiveError = viewerError ?? loadError;

  // Reset state when series changes
  useEffect(() => {
    setViewerError(null);
    setActiveViewport(null);
    setMaximizedViewport(null);
  }, [series?.id]);

  const handleReset = useCallback(() => {
    setActiveTool('crosshairs');
    setSelectedPresetId(windowLevelPresets[0].id);
    setMaximizedViewport(null);
    // Reset slab settings
    setSlabSettings({ thickness: 0, blendMode: 'composite' });
  }, [setSlabSettings]);

  const handleMaximize = useCallback((orientation: MPROrientation | null) => {
    setMaximizedViewport(orientation);
    if (orientation) {
      setActiveViewport(orientation);
    }
  }, []);

  const handleViewportClick = useCallback((orientation: MPROrientation) => {
    setActiveViewport(orientation);
  }, []);

  if (!series) {
    return (
      <ViewerEmptyState 
        title="MPR-Viewer"
        subtitle="Wählen Sie eine Serie für die Multi-Planar-Rekonstruktion"
      />
    );
  }

  const renderViewport = (orientation: MPROrientation) => {
    const config = MPR_VIEWPORTS.find(v => v.orientation === orientation)!;
    const state = sliceState[orientation];
    
    return (
      <MPRViewport
        key={orientation}
        ref={viewportRefs[orientation]}
        config={config}
        sliceIndex={state.sliceIndex}
        totalSlices={state.totalSlices}
        isActive={activeViewport === orientation}
        onClick={() => handleViewportClick(orientation)}
        className="flex-1"
        slabSettings={slabSettings}
      />
    );
  };

  return (
    <div className={cn('h-full flex flex-col bg-viewer', className)}>
      {/* Toolbar */}
      <MPRToolbar
        activeTool={activeTool}
        onToolSelect={setActiveTool}
        onReset={handleReset}
        presets={windowLevelPresets}
        selectedPresetId={selectedPresetId}
        onPresetChange={setSelectedPresetId}
        activeViewport={activeViewport}
        onMaximize={handleMaximize}
        isMaximized={Boolean(maximizedViewport)}
        slabSettings={slabSettings}
        onSlabSettingsChange={setSlabSettings}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">
              {isFetchingInstances ? 'Lade DICOM-Daten...' : 'Erstelle 3D-Volumen...'}
            </span>
            <span className="text-xs text-muted-foreground/60">
              {imageIds.length} Bilder
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {effectiveError && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-destructive">
            <p className="text-sm font-medium">Fehler beim Laden</p>
            <p className="text-xs text-muted-foreground mt-1">{effectiveError}</p>
          </div>
        </div>
      )}

      {/* Viewports grid */}
      {!isLoading && !effectiveError && (
        <div className="flex-1 p-2">
          {maximizedViewport ? (
            // Single maximized viewport
            <div className="h-full">
              {renderViewport(maximizedViewport)}
            </div>
          ) : (
            // 2x2 grid (3 viewports + info panel)
            <div className="h-full grid grid-cols-2 grid-rows-2 gap-2">
              {renderViewport('axial')}
              {renderViewport('sagittal')}
              {renderViewport('coronal')}
              
              {/* Info panel */}
              <div className="bg-card rounded-lg border border-border p-4 flex flex-col">
                <h3 className="text-sm font-semibold mb-3">MPR Navigation</h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgb(255, 99, 71)' }} />
                    <span className="text-muted-foreground">Axial (Transversal)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgb(50, 205, 50)' }} />
                    <span className="text-muted-foreground">Sagittal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgb(30, 144, 255)' }} />
                    <span className="text-muted-foreground">Coronal (Frontal)</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border space-y-1 text-xs text-muted-foreground">
                  <p><kbd className="px-1 bg-muted rounded">LMB</kbd> Crosshairs</p>
                  <p><kbd className="px-1 bg-muted rounded">RMB</kbd> Pan</p>
                  <p><kbd className="px-1 bg-muted rounded">Scroll</kbd> Zoom</p>
                  <p><kbd className="px-1 bg-muted rounded">Shift+LMB</kbd> W/L</p>
                </div>

                {series && (
                  <div className="mt-auto pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground truncate">{series.seriesDescription}</p>
                    <p className="text-xs text-muted-foreground">{series.modality} • {imageIds.length} Bilder</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
