import { useState, useMemo, useEffect, useCallback } from 'react';
import { Loader2, Box } from 'lucide-react';
import type { Series } from '@/types/radiology';
import { useDicomSeriesInstances } from '@/hooks/useDicomSeriesInstances';
import { useVRTViewport } from '@/hooks/useVRTViewport';
import { VRTToolbar } from './VRTToolbar';
import { ViewerEmptyState } from './ViewerEmptyState';
import { VRT_PRESETS, DEFAULT_VRT_SETTINGS, type VRTViewAngle } from '@/types/vrt';
import { cn } from '@/lib/utils';

// Keyboard shortcut mappings
const PRESET_SHORTCUTS: Record<string, number> = {
  '1': 0, // CT Bone
  '2': 1, // CT Lung
  '3': 2, // CT Soft Tissue
  '4': 3, // CT Angiography
  '5': 4, // CT Muscle/Bone
};

const VIEW_ANGLE_SHORTCUTS: Record<string, VRTViewAngle> = {
  'a': 'anterior',
  'p': 'posterior',
  'l': 'left',
  'r': 'right',
  's': 'superior',
  'i': 'inferior',
};

interface VRTViewerProps {
  series: Series | null;
  className?: string;
}

export function VRTViewer({ series, className }: VRTViewerProps) {
  const [viewerError, setViewerError] = useState<string | null>(null);

  const {
    imageIds,
    isLoading: isFetchingInstances,
    error: loadError,
  } = useDicomSeriesInstances(series);

  const viewerInstanceId = useMemo(
    () => `vrt-viewer-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  const {
    viewportRef,
    isInitializing,
    isReady,
    settings,
    setSettings,
    applyPreset,
    setViewAngle,
    resetCamera,
  } = useVRTViewport({
    isEnabled: Boolean(series) && imageIds.length > 0,
    imageIds,
    renderingEngineId: `${viewerInstanceId}-engine`,
    viewportId: `${viewerInstanceId}-viewport`,
    toolGroupId: `${viewerInstanceId}-tools`,
    onInitError: setViewerError,
  });

  const isLoading = isFetchingInstances || isInitializing;
  const effectiveError = viewerError ?? loadError;

  // Reset state when series changes
  useEffect(() => {
    setViewerError(null);
  }, [series?.id]);

  const handleReset = useCallback(() => {
    resetCamera();
    applyPreset(DEFAULT_VRT_SETTINGS.presetId);
    setSettings(DEFAULT_VRT_SETTINGS);
  }, [resetCamera, applyPreset, setSettings]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isReady) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focused on input elements
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement ||
          e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const key = e.key.toLowerCase();

      // Preset shortcuts (1-5)
      if (key in PRESET_SHORTCUTS) {
        const presetIndex = PRESET_SHORTCUTS[key];
        if (presetIndex < VRT_PRESETS.length) {
          e.preventDefault();
          applyPreset(VRT_PRESETS[presetIndex].id);
        }
        return;
      }

      // View angle shortcuts (A/P/L/R/S/I)
      if (key in VIEW_ANGLE_SHORTCUTS) {
        e.preventDefault();
        setViewAngle(VIEW_ANGLE_SHORTCUTS[key]);
        return;
      }

      // Reset with Escape
      if (key === 'escape') {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReady, applyPreset, setViewAngle, handleReset]);

  if (!series) {
    return (
      <ViewerEmptyState 
        title="3D Volume Rendering"
        subtitle="Wählen Sie eine Serie für die 3D-Darstellung"
      />
    );
  }

  // Check if modality supports VRT
  const supportedModalities = ['CT', 'MR', 'PT'];
  if (!supportedModalities.includes(series.modality)) {
    return (
      <ViewerEmptyState 
        title="3D Volume Rendering"
        subtitle={`Modalität ${series.modality} wird nicht unterstützt. Nur CT, MR und PT sind verfügbar.`}
      />
    );
  }

  // Need enough slices for 3D
  if (imageIds.length < 10) {
    return (
      <ViewerEmptyState 
        title="3D Volume Rendering"
        subtitle={`Nicht genügend Bilder für 3D-Rendering. Mindestens 10 erforderlich, ${imageIds.length} vorhanden.`}
      />
    );
  }

  return (
    <div className={cn('h-full flex flex-col bg-viewer', className)}>
      {/* Toolbar */}
      <VRTToolbar
        settings={settings}
        onSettingsChange={setSettings}
        onPresetChange={applyPreset}
        onViewAngle={setViewAngle}
        onReset={handleReset}
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

      {/* 3D Viewport */}
      {!isLoading && !effectiveError && (
        <div className="flex-1 relative">
          {/* Viewport container */}
          <div 
            ref={viewportRef}
            className="absolute inset-0 bg-black"
          />

          {/* Overlay info */}
          {isReady && (
            <>
              {/* Preset badge */}
              <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-xs text-white">
                {VRT_PRESETS.find(p => p.id === settings.presetId)?.name || 'Custom'}
              </div>

              {/* Controls hint */}
              <div className="absolute bottom-3 left-3 space-y-0.5 text-xs text-white/70 bg-black/40 rounded px-2 py-1">
                <p><kbd className="px-1 bg-black/40 rounded">LMB</kbd> Rotieren</p>
                <p><kbd className="px-1 bg-black/40 rounded">RMB</kbd> Pan</p>
                <p><kbd className="px-1 bg-black/40 rounded">Scroll</kbd> Zoom</p>
                <div className="border-t border-white/20 mt-1 pt-1">
                  <p><kbd className="px-1 bg-black/40 rounded">1-5</kbd> Presets</p>
                  <p><kbd className="px-1 bg-black/40 rounded">A/P/L/R/S/I</kbd> Ansicht</p>
                  <p><kbd className="px-1 bg-black/40 rounded">Esc</kbd> Reset</p>
                </div>
              </div>

              {/* Series info */}
              {series && (
                <div className="absolute bottom-3 right-3 text-right text-xs text-white/70 bg-black/40 rounded px-2 py-1">
                  <p className="truncate max-w-[200px]">{series.seriesDescription}</p>
                  <p>{series.modality} • {imageIds.length} Bilder</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
