import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  Enums, 
  RenderingEngine, 
  volumeLoader,
  cache,
  VolumeViewport3D,
} from '@cornerstonejs/core';
import { 
  ToolGroupManager, 
  TrackballRotateTool,
} from '@cornerstonejs/tools';
import { initCornerstone, cornerstoneToolNames, getCornerstoneInitErrorMessage } from '@/services/cornerstone';
import { VRT_PRESETS, VRT_VIEW_ANGLES, DEFAULT_VRT_SETTINGS, type VRTSettings, type VRTViewAngle, type VRTPreset } from '@/types/vrt';

/** Minimal VTK actor property interface (VTK.js types not shipped by Cornerstone). */
interface VTKActorProperty {
  getRGBTransferFunction?: (index: number) => { removeAllPoints: () => void; addRGBPoint: (x: number, r: number, g: number, b: number) => void };
  getScalarOpacity?: (index: number) => { removeAllPoints: () => void; addPoint: (x: number, y: number) => void };
  setAmbient?: (v: number) => void;
  setDiffuse?: (v: number) => void;
  setSpecular?: (v: number) => void;
  setSpecularPower?: (v: number) => void;
}
interface VTKActor {
  getProperty: () => VTKActorProperty;
}
interface VTKVolumeActor {
  actor: VTKActor;
  getProperty: () => VTKActorProperty;
}

interface UseVRTViewportOptions {
  isEnabled: boolean;
  imageIds: string[];
  renderingEngineId: string;
  viewportId: string;
  toolGroupId: string;
  onInitError?: (error: string | null) => void;
}

interface UseVRTViewportResult {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  volumeViewport: VolumeViewport3D | null;
  isInitializing: boolean;
  isReady: boolean;
  settings: VRTSettings;
  setSettings: (settings: VRTSettings) => void;
  applyPreset: (presetId: string) => void;
  setViewAngle: (angle: VRTViewAngle) => void;
  resetCamera: () => void;
  renderingEngineRef: React.RefObject<RenderingEngine | null>;
}

export const useVRTViewport = ({
  isEnabled,
  imageIds,
  renderingEngineId,
  viewportId,
  toolGroupId,
  onInitError,
}: UseVRTViewportOptions): UseVRTViewportResult => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const volumeIdRef = useRef<string | null>(null);
  const volumeActorRef = useRef<VTKVolumeActor | null>(null);
  
  const [volumeViewport, setVolumeViewport] = useState<VolumeViewport3D | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [settings, setSettingsState] = useState<VRTSettings>(DEFAULT_VRT_SETTINGS);

  const onInitErrorRef = useRef(onInitError);

  useEffect(() => {
    onInitErrorRef.current = onInitError;
  }, [onInitError]);

  // Apply transfer function to volume actor
  const applyTransferFunction = useCallback((preset: VRTPreset) => {
    const viewport = volumeViewport;
    if (!viewport || !volumeIdRef.current) return;

    try {
      const volumeActor = viewport.getDefaultActor();
      if (!volumeActor?.actor) return;

      const actor = volumeActor.actor as VTKActor;
      const property = actor.getProperty();
      
      // Get or create transfer functions
      const colorTF = property.getRGBTransferFunction?.(0);
      const opacityTF = property.getScalarOpacity?.(0);
      
      if (colorTF && opacityTF) {
        // Clear existing points
        colorTF.removeAllPoints();
        opacityTF.removeAllPoints();
        
        // Add color points
        preset.transferFunction.colorPoints.forEach((point) => {
          colorTF.addRGBPoint(point.x, point.r, point.g, point.b);
        });
        
        // Add opacity points
        preset.transferFunction.opacityPoints.forEach((point) => {
          opacityTF.addPoint(point.x, point.y);
        });
        
        // Set lighting properties
        property.setAmbient?.(preset.ambient);
        property.setDiffuse?.(preset.diffuse);
        property.setSpecular?.(preset.specular);
        property.setSpecularPower?.(preset.specularPower);
        property.setShade?.(true);
      }
      
      viewport.render();
    } catch (e) {
      console.warn('Failed to apply transfer function:', e);
    }
  }, [volumeViewport]);

  // Apply preset
  const applyPreset = useCallback((presetId: string) => {
    const preset = VRT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    
    setSettingsState(prev => ({
      ...prev,
      presetId,
      ambient: preset.ambient,
      diffuse: preset.diffuse,
      specular: preset.specular,
      specularPower: preset.specularPower,
    }));
    
    applyTransferFunction(preset);
  }, [applyTransferFunction]);

  // Set view angle
  const setViewAngle = useCallback((angle: VRTViewAngle) => {
    if (!volumeViewport) return;
    
    try {
      const viewConfig = VRT_VIEW_ANGLES[angle];
      const camera = volumeViewport.getCamera();
      
      // Calculate position based on focal point and desired direction
      const focalPoint = camera.focalPoint || [0, 0, 0];
      const distance = camera.parallelScale || 500;
      
      const position: [number, number, number] = [
        focalPoint[0] + viewConfig.position[0] * distance,
        focalPoint[1] + viewConfig.position[1] * distance,
        focalPoint[2] + viewConfig.position[2] * distance,
      ];
      
      volumeViewport.setCamera({
        position,
        focalPoint,
        viewUp: viewConfig.viewUp,
      });
      
      volumeViewport.render();
    } catch (e) {
      console.warn('Failed to set view angle:', e);
    }
  }, [volumeViewport]);

  // Reset camera
  const resetCamera = useCallback(() => {
    if (!volumeViewport) return;
    
    try {
      volumeViewport.resetCamera();
      volumeViewport.render();
    } catch (e) {
      console.warn('Failed to reset camera:', e);
    }
  }, [volumeViewport]);

  // Update settings
  const setSettings = useCallback((newSettings: VRTSettings) => {
    setSettingsState(newSettings);
    
    if (!volumeViewport) return;
    
    try {
      // Apply sample distance
      volumeViewport.setSampleDistanceMultiplier(newSettings.sampleDistance);
      
      // Apply lighting settings to volume actor
      const volumeActor = volumeViewport.getDefaultActor();
      if (volumeActor?.actor) {
        const property = (volumeActor.actor as VTKActor).getProperty();
        property.setAmbient?.(newSettings.ambient);
        property.setDiffuse?.(newSettings.diffuse);
        property.setSpecular?.(newSettings.specular);
        property.setSpecularPower?.(newSettings.specularPower);
      }
      
      volumeViewport.render();
    } catch (e) {
      console.warn('Failed to apply VRT settings:', e);
    }
  }, [volumeViewport]);

  useEffect(() => {
    if (!isEnabled || imageIds.length === 0) return;
    if (!viewportRef.current) return;

    let isActive = true;

    const setupVRT = async () => {
      setIsInitializing(true);
      onInitErrorRef.current?.(null);

      try {
        await initCornerstone();
        // TrackballRotateTool is registered in cornerstone.ts

        if (!isActive) return;

        // Create unique volume ID
        const volumeId = `cornerstoneStreamingImageVolume:${renderingEngineId}-vrt-volume-${Date.now()}`;
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

        // Define 3D viewport
        const viewportInput = {
          viewportId,
          type: Enums.ViewportType.VOLUME_3D,
          element: viewportRef.current!,
          defaultOptions: {
            background: [0, 0, 0] as [number, number, number],
          },
        };

        renderingEngine.setViewports([viewportInput]);

        // Get viewport
        const viewport = renderingEngine.getViewport(viewportId) as VolumeViewport3D;

        // Set volume on viewport with transfer function callback
        const initialPreset = VRT_PRESETS.find(p => p.id === settings.presetId) || VRT_PRESETS[0];
        
        await viewport.setVolumes([
          {
            volumeId,
            callback: ({ volumeActor }: { volumeActor: VTKVolumeActor }) => {
              volumeActorRef.current = volumeActor;
              
              const property = volumeActor.getProperty();
              const colorTF = property.getRGBTransferFunction(0);
              const opacityTF = property.getScalarOpacity(0);
              
              if (colorTF && opacityTF) {
                colorTF.removeAllPoints();
                opacityTF.removeAllPoints();
                
                initialPreset.transferFunction.colorPoints.forEach((point) => {
                  colorTF.addRGBPoint(point.x, point.r, point.g, point.b);
                });
                
                initialPreset.transferFunction.opacityPoints.forEach((point) => {
                  opacityTF.addPoint(point.x, point.y);
                });
                
                property.setAmbient(initialPreset.ambient);
                property.setDiffuse(initialPreset.diffuse);
                property.setSpecular(initialPreset.specular);
                property.setSpecularPower(initialPreset.specularPower);
                property.setShade(true);
              }
            },
          },
        ]);

        // Create tool group for 3D interaction
        const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
        if (toolGroup) {
          toolGroup.addTool(TrackballRotateTool.toolName);
          toolGroup.addTool(cornerstoneToolNames.pan);
          toolGroup.addTool(cornerstoneToolNames.zoom);

          toolGroup.addViewport(viewportId, renderingEngineId);

          // Left click: rotate
          toolGroup.setToolActive(TrackballRotateTool.toolName, {
            bindings: [{ mouseButton: 1 }],
          });
          // Right click: pan
          toolGroup.setToolActive(cornerstoneToolNames.pan, {
            bindings: [{ mouseButton: 2 }],
          });
          // Middle click: zoom
          toolGroup.setToolActive(cornerstoneToolNames.zoom, {
            bindings: [{ mouseButton: 3 }],
          });
        }

        // Reset camera to show full volume
        viewport.resetCamera();
        renderingEngine.renderViewports([viewportId]);

        setVolumeViewport(viewport);
        setIsReady(true);

      } catch (error) {
        console.error('VRT initialization failed:', error);
        if (isActive) {
          onInitErrorRef.current?.(
            getCornerstoneInitErrorMessage('3D-Viewer konnte nicht initialisiert werden.', error)
          );
        }
      } finally {
        if (isActive) {
          setIsInitializing(false);
        }
      }
    };

    setupVRT();

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

      volumeActorRef.current = null;
      setVolumeViewport(null);
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settings.presetId is intentionally only read at init time
  }, [isEnabled, imageIds, renderingEngineId, viewportId, toolGroupId]);

  return {
    viewportRef,
    volumeViewport,
    isInitializing,
    isReady,
    settings,
    setSettings,
    applyPreset,
    setViewAngle,
    resetCamera,
    renderingEngineRef,
  };
};
