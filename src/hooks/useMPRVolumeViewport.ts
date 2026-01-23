import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  Enums, 
  RenderingEngine, 
  volumeLoader,
  cache,
  VolumeViewport,
} from '@cornerstonejs/core';
import { 
  ToolGroupManager, 
  CrosshairsTool,
  addTool,
  Enums as ToolEnums,
} from '@cornerstonejs/tools';
import { initCornerstone, cornerstoneToolNames } from '@/services/cornerstone';
import type { MPROrientation, MPRViewportState, SlabBlendMode, SlabSettings } from '@/types/mpr';

// Ensure CrosshairsTool is registered
let crosshairsRegistered = false;
const registerCrosshairs = () => {
  if (!crosshairsRegistered) {
    try {
      addTool(CrosshairsTool);
      crosshairsRegistered = true;
    } catch (e) {
      // Already registered
    }
  }
};

// Map our blend mode to Cornerstone BlendModes
const blendModeToCornerstone: Record<SlabBlendMode, Enums.BlendModes> = {
  composite: Enums.BlendModes.COMPOSITE,
  mip: Enums.BlendModes.MAXIMUM_INTENSITY_BLEND,
  minip: Enums.BlendModes.MINIMUM_INTENSITY_BLEND,
  average: Enums.BlendModes.AVERAGE_INTENSITY_BLEND,
};

interface UseMPRVolumeViewportOptions {
  isEnabled: boolean;
  imageIds: string[];
  renderingEngineId: string;
  viewportIds: {
    axial: string;
    sagittal: string;
    coronal: string;
  };
  toolGroupId: string;
  onSliceChange?: (state: MPRViewportState) => void;
  onInitError?: (error: string | null) => void;
}

interface UseMPRVolumeViewportResult {
  viewportRefs: {
    axial: React.RefObject<HTMLDivElement | null>;
    sagittal: React.RefObject<HTMLDivElement | null>;
    coronal: React.RefObject<HTMLDivElement | null>;
  };
  volumeViewports: {
    axial: VolumeViewport | null;
    sagittal: VolumeViewport | null;
    coronal: VolumeViewport | null;
  };
  isInitializing: boolean;
  isReady: boolean;
  sliceState: MPRViewportState;
  jumpToSlice: (orientation: MPROrientation, sliceIndex: number) => void;
  slabSettings: SlabSettings;
  setSlabSettings: (settings: SlabSettings) => void;
  renderingEngineRef: React.RefObject<RenderingEngine | null>;
}

const orientationToAxis: Record<MPROrientation, Enums.OrientationAxis> = {
  axial: Enums.OrientationAxis.AXIAL,
  sagittal: Enums.OrientationAxis.SAGITTAL,
  coronal: Enums.OrientationAxis.CORONAL,
};

export const useMPRVolumeViewport = ({
  isEnabled,
  imageIds,
  renderingEngineId,
  viewportIds,
  toolGroupId,
  onSliceChange,
  onInitError,
}: UseMPRVolumeViewportOptions): UseMPRVolumeViewportResult => {
  const axialRef = useRef<HTMLDivElement | null>(null);
  const sagittalRef = useRef<HTMLDivElement | null>(null);
  const coronalRef = useRef<HTMLDivElement | null>(null);
  
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const volumeIdRef = useRef<string | null>(null);
  
  const [volumeViewports, setVolumeViewports] = useState<{
    axial: VolumeViewport | null;
    sagittal: VolumeViewport | null;
    coronal: VolumeViewport | null;
  }>({
    axial: null,
    sagittal: null,
    coronal: null,
  });
  
  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [sliceState, setSliceState] = useState<MPRViewportState>({
    axial: { sliceIndex: 0, totalSlices: 0 },
    sagittal: { sliceIndex: 0, totalSlices: 0 },
    coronal: { sliceIndex: 0, totalSlices: 0 },
  });
  const [slabSettings, setSlabSettingsState] = useState<SlabSettings>({
    thickness: 0,
    blendMode: 'composite',
  });

  const onSliceChangeRef = useRef(onSliceChange);
  const onInitErrorRef = useRef(onInitError);

  useEffect(() => {
    onSliceChangeRef.current = onSliceChange;
  }, [onSliceChange]);

  useEffect(() => {
    onInitErrorRef.current = onInitError;
  }, [onInitError]);

  // Jump to specific slice
  const jumpToSlice = useCallback((orientation: MPROrientation, sliceIndex: number) => {
    const viewport = volumeViewports[orientation];
    if (!viewport) return;
    
    try {
      // Use scroll API for volume viewports
      const camera = viewport.getCamera();
      const imageData = viewport.getImageData();
      if (imageData) {
        const { dimensions } = imageData;
        const maxIndex = dimensions[2] - 1;
        const clampedIndex = Math.max(0, Math.min(sliceIndex, maxIndex));
        viewport.scroll(clampedIndex - (viewport.getCurrentImageIdIndex?.() || 0));
        viewport.render();
      }
    } catch (e) {
      console.warn('Failed to jump to slice:', e);
    }
  }, [volumeViewports]);

  // Update slice state for all viewports
  const updateSliceState = useCallback(() => {
    const newState: MPRViewportState = {
      axial: { sliceIndex: 0, totalSlices: 0 },
      sagittal: { sliceIndex: 0, totalSlices: 0 },
      coronal: { sliceIndex: 0, totalSlices: 0 },
    };

    (['axial', 'sagittal', 'coronal'] as MPROrientation[]).forEach((orientation) => {
      const vp = volumeViewports[orientation];
      if (vp) {
        try {
          const imageData = vp.getImageData();
          if (imageData) {
            const { dimensions } = imageData;
            const currentIndex = vp.getCurrentImageIdIndex?.() || 0;
            newState[orientation] = {
              sliceIndex: currentIndex,
              totalSlices: dimensions[2] || 0,
            };
          }
        } catch (e) {
          // Viewport not ready
        }
      }
    });

    setSliceState(newState);
    onSliceChangeRef.current?.(newState);
  }, [volumeViewports]);

  useEffect(() => {
    if (!isEnabled || imageIds.length === 0) return;
    if (!axialRef.current || !sagittalRef.current || !coronalRef.current) return;

    let isActive = true;

    const setupMPR = async () => {
      setIsInitializing(true);
      onInitErrorRef.current?.(null);

      try {
        await initCornerstone();
        registerCrosshairs();

        if (!isActive) return;

        // Create unique volume ID
        const volumeId = `cornerstoneStreamingImageVolume:${renderingEngineId}-volume-${Date.now()}`;
        volumeIdRef.current = volumeId;

        // Create and load volume
        const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
        
        if (!isActive) return;

        // Load volume data
        await volume.load();

        if (!isActive) return;

        // Create rendering engine
        const renderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngineRef.current = renderingEngine;

        // Define viewports
        const viewportInputArray = [
          {
            viewportId: viewportIds.axial,
            type: Enums.ViewportType.ORTHOGRAPHIC,
            element: axialRef.current!,
            defaultOptions: {
              orientation: orientationToAxis.axial,
              background: [0, 0, 0] as [number, number, number],
            },
          },
          {
            viewportId: viewportIds.sagittal,
            type: Enums.ViewportType.ORTHOGRAPHIC,
            element: sagittalRef.current!,
            defaultOptions: {
              orientation: orientationToAxis.sagittal,
              background: [0, 0, 0] as [number, number, number],
            },
          },
          {
            viewportId: viewportIds.coronal,
            type: Enums.ViewportType.ORTHOGRAPHIC,
            element: coronalRef.current!,
            defaultOptions: {
              orientation: orientationToAxis.coronal,
              background: [0, 0, 0] as [number, number, number],
            },
          },
        ];

        renderingEngine.setViewports(viewportInputArray);

        // Get viewports
        const axialViewport = renderingEngine.getViewport(viewportIds.axial) as VolumeViewport;
        const sagittalViewport = renderingEngine.getViewport(viewportIds.sagittal) as VolumeViewport;
        const coronalViewport = renderingEngine.getViewport(viewportIds.coronal) as VolumeViewport;

        // Set volume on viewports
        await Promise.all([
          axialViewport.setVolumes([{ volumeId }]),
          sagittalViewport.setVolumes([{ volumeId }]),
          coronalViewport.setVolumes([{ volumeId }]),
        ]);

        // Create tool group
        const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
        if (toolGroup) {
          toolGroup.addTool(cornerstoneToolNames.pan);
          toolGroup.addTool(cornerstoneToolNames.zoom);
          toolGroup.addTool(cornerstoneToolNames.windowLevel);
          toolGroup.addTool(cornerstoneToolNames.stackScroll);
          toolGroup.addTool(CrosshairsTool.toolName, {
            getReferenceLineColor: (viewportId: string) => {
              if (viewportId === viewportIds.axial) return 'rgb(255, 99, 71)';
              if (viewportId === viewportIds.sagittal) return 'rgb(50, 205, 50)';
              if (viewportId === viewportIds.coronal) return 'rgb(30, 144, 255)';
              return 'rgb(255, 255, 255)';
            },
            getReferenceLineControllable: () => true,
            getReferenceLineDraggableRotatable: () => true,
            getReferenceLineSlabThicknessControlsOn: () => false,
          });

          toolGroup.addViewport(viewportIds.axial, renderingEngineId);
          toolGroup.addViewport(viewportIds.sagittal, renderingEngineId);
          toolGroup.addViewport(viewportIds.coronal, renderingEngineId);

          // Activate crosshairs
          toolGroup.setToolActive(CrosshairsTool.toolName, {
            bindings: [{ mouseButton: 1 }],
          });
          toolGroup.setToolActive(cornerstoneToolNames.pan, {
            bindings: [{ mouseButton: 2 }],
          });
          toolGroup.setToolActive(cornerstoneToolNames.zoom, {
            bindings: [{ mouseButton: 3 }],
          });
          // Window level with keyboard modifier
          toolGroup.setToolActive(cornerstoneToolNames.windowLevel, {
            bindings: [{ mouseButton: 1, modifierKey: ToolEnums.KeyboardBindings.Shift }],
          });
        }

        // Render all viewports
        renderingEngine.renderViewports([
          viewportIds.axial,
          viewportIds.sagittal,
          viewportIds.coronal,
        ]);

        setVolumeViewports({
          axial: axialViewport,
          sagittal: sagittalViewport,
          coronal: coronalViewport,
        });
        setIsReady(true);

      } catch (error) {
        console.error('MPR initialization failed:', error);
        if (isActive) {
          onInitErrorRef.current?.('MPR-Viewer konnte nicht initialisiert werden.');
        }
      } finally {
        if (isActive) {
          setIsInitializing(false);
        }
      }
    };

    setupMPR();

    return () => {
      isActive = false;

      ToolGroupManager.destroyToolGroup(toolGroupId);

      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
        renderingEngineRef.current = null;
      }

      // Clean up volume from cache
      if (volumeIdRef.current) {
        try {
          cache.removeVolumeLoadObject(volumeIdRef.current);
        } catch (e) {
          // Volume might not exist
        }
        volumeIdRef.current = null;
      }

      setVolumeViewports({ axial: null, sagittal: null, coronal: null });
      setIsReady(false);
    };
  }, [isEnabled, imageIds, renderingEngineId, viewportIds, toolGroupId]);

  // Update slice state when viewports are ready
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(updateSliceState, 100);
    return () => clearInterval(interval);
  }, [isReady, updateSliceState]);

  // Apply slab settings to all viewports
  const setSlabSettings = useCallback((settings: SlabSettings) => {
    setSlabSettingsState(settings);
    
    const viewports = [volumeViewports.axial, volumeViewports.sagittal, volumeViewports.coronal];
    viewports.forEach((viewport) => {
      if (!viewport) return;
      
      try {
        // Set blend mode
        const cornerstoneBlendMode = blendModeToCornerstone[settings.blendMode];
        viewport.setBlendMode(cornerstoneBlendMode);
        
        // Set slab thickness
        if (settings.thickness > 0) {
          viewport.setSlabThickness(settings.thickness);
        } else {
          viewport.resetSlabThickness();
        }
        
        viewport.render();
      } catch (e) {
        console.warn('Failed to apply slab settings:', e);
      }
    });
    
    // Trigger re-render of all viewports
    if (renderingEngineRef.current) {
      renderingEngineRef.current.renderViewports([
        viewportIds.axial,
        viewportIds.sagittal,
        viewportIds.coronal,
      ]);
    }
  }, [volumeViewports, viewportIds]);

  return {
    viewportRefs: {
      axial: axialRef,
      sagittal: sagittalRef,
      coronal: coronalRef,
    },
    volumeViewports,
    isInitializing,
    isReady,
    sliceState,
    jumpToSlice,
    slabSettings,
    setSlabSettings,
    renderingEngineRef,
  };
};
