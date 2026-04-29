import { useCallback, useEffect, useRef, useState } from 'react';
// vtk.js side-effect import: ensure geometry rendering profile is registered.
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';

interface VtkScene {
  fullScreen: ReturnType<typeof vtkFullScreenRenderWindow.newInstance>;
  renderer: ReturnType<
    ReturnType<typeof vtkFullScreenRenderWindow.newInstance>['getRenderer']
  >;
  renderWindow: ReturnType<
    ReturnType<typeof vtkFullScreenRenderWindow.newInstance>['getRenderWindow']
  >;
}

interface ActorEntry {
  actor: ReturnType<typeof vtkActor.newInstance>;
  mapper: ReturnType<typeof vtkMapper.newInstance>;
}

export type ClipAxis = 'x' | 'y' | 'z';

interface UseMeshSceneResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  loadVtp: (labelId: number, data: ArrayBuffer) => void;
  setVisibility: (labelId: number, visible: boolean) => void;
  setOpacity: (labelId: number, opacity: number) => void;
  setColor: (labelId: number, rgb: [number, number, number]) => void;
  resetCamera: () => void;
  isReady: boolean;
  /** Toggle a single LPS-axis-aligned clipping plane across all actors. */
  enableClipPlane: (enabled: boolean, axis?: ClipAxis) => void;
  /** Slide the active clip plane along its axis. No-op if no plane is active. */
  setClipPlanePosition: (value: number) => void;
  /** Aggregate bounds across all loaded actors for the requested axis. */
  getClipPlaneRange: (axis?: ClipAxis) => [number, number] | null;
}

const AXIS_INDEX: Record<ClipAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export function useMeshScene(): UseMeshSceneResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<VtkScene | null>(null);
  const actorsRef = useRef<Map<number, ActorEntry>>(new Map());
  const [isReady, setIsReady] = useState(false);

  // Aggregate bounds across all actors: [xmin, xmax, ymin, ymax, zmin, zmax].
  const boundsRef = useRef<[number, number, number, number, number, number] | null>(null);
  const clipPlaneRef = useRef<ReturnType<typeof vtkPlane.newInstance> | null>(null);
  const clipAxisRef = useRef<ClipAxis>('z');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fullScreen = vtkFullScreenRenderWindow.newInstance({
      container,
      containerStyle: {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
      },
      background: [0.05, 0.07, 0.1],
    });
    const renderer = fullScreen.getRenderer();
    const renderWindow = fullScreen.getRenderWindow();
    sceneRef.current = { fullScreen, renderer, renderWindow };
    setIsReady(true);

    const actors = actorsRef.current;
    return () => {
      actors.forEach(({ actor, mapper }) => {
        try {
          renderer.removeActor(actor);
        } catch {
          /* noop */
        }
        actor.delete?.();
        mapper.delete?.();
      });
      actors.clear();
      clipPlaneRef.current?.delete?.();
      clipPlaneRef.current = null;
      boundsRef.current = null;
      fullScreen.delete();
      sceneRef.current = null;
      setIsReady(false);
    };
  }, []);

  const _aggregateBounds = useCallback(
    (incoming: number[]) => {
      if (!incoming || incoming.length !== 6) return;
      const current = boundsRef.current;
      if (!current) {
        boundsRef.current = [
          incoming[0], incoming[1],
          incoming[2], incoming[3],
          incoming[4], incoming[5],
        ];
        return;
      }
      boundsRef.current = [
        Math.min(current[0], incoming[0]),
        Math.max(current[1], incoming[1]),
        Math.min(current[2], incoming[2]),
        Math.max(current[3], incoming[3]),
        Math.min(current[4], incoming[4]),
        Math.max(current[5], incoming[5]),
      ];
    },
    [],
  );

  const _normalForAxis = (axis: ClipAxis): [number, number, number] => {
    if (axis === 'x') return [1, 0, 0];
    if (axis === 'y') return [0, 1, 0];
    return [0, 0, 1];
  };

  const loadVtp = useCallback(
    (labelId: number, data: ArrayBuffer) => {
      const scene = sceneRef.current;
      if (!scene) return;

      const existing = actorsRef.current.get(labelId);
      if (existing) {
        scene.renderer.removeActor(existing.actor);
        existing.actor.delete?.();
        existing.mapper.delete?.();
        actorsRef.current.delete(labelId);
      }

      const reader = vtkXMLPolyDataReader.newInstance();
      if (typeof reader.parseAsArrayBuffer === 'function') {
        reader.parseAsArrayBuffer(data);
      } else {
        const text = new TextDecoder().decode(new Uint8Array(data));
        reader.parseAsText(text);
      }

      const polyData = reader.getOutputData(0);
      const mapper = vtkMapper.newInstance();
      mapper.setInputData(polyData);
      const actor = vtkActor.newInstance();
      actor.setMapper(mapper);

      // Inherit the active clip plane so newly loaded labels are clipped too.
      if (clipPlaneRef.current && typeof mapper.addClippingPlane === 'function') {
        mapper.addClippingPlane(clipPlaneRef.current);
      }

      scene.renderer.addActor(actor);
      actorsRef.current.set(labelId, { actor, mapper });

      if (typeof polyData.getBounds === 'function') {
        _aggregateBounds(polyData.getBounds());
      }

      if (actorsRef.current.size === 1) {
        scene.renderer.resetCamera();
      }
      scene.renderWindow.render();
    },
    [_aggregateBounds],
  );

  const setVisibility = useCallback((labelId: number, visible: boolean) => {
    const scene = sceneRef.current;
    const entry = actorsRef.current.get(labelId);
    if (!scene || !entry) return;
    entry.actor.setVisibility(visible);
    scene.renderWindow.render();
  }, []);

  const setOpacity = useCallback((labelId: number, opacity: number) => {
    const scene = sceneRef.current;
    const entry = actorsRef.current.get(labelId);
    if (!scene || !entry) return;
    entry.actor.getProperty().setOpacity(opacity);
    scene.renderWindow.render();
  }, []);

  const setColor = useCallback(
    (labelId: number, rgb: [number, number, number]) => {
      const scene = sceneRef.current;
      const entry = actorsRef.current.get(labelId);
      if (!scene || !entry) return;
      entry.actor.getProperty().setColor(rgb[0], rgb[1], rgb[2]);
      scene.renderWindow.render();
    },
    [],
  );

  const resetCamera = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.renderer.resetCamera();
    scene.renderWindow.render();
  }, []);

  const enableClipPlane = useCallback((enabled: boolean, axis: ClipAxis = 'z') => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (!enabled) {
      const plane = clipPlaneRef.current;
      if (plane) {
        actorsRef.current.forEach(({ mapper }) => {
          try {
            mapper.removeClippingPlane?.(plane);
          } catch {
            /* mapper may have already been freed */
          }
        });
        plane.delete?.();
        clipPlaneRef.current = null;
      }
      scene.renderWindow.render();
      return;
    }

    clipAxisRef.current = axis;
    const bounds = boundsRef.current;
    const idx = AXIS_INDEX[axis];
    const min = bounds ? bounds[idx * 2] : 0;
    const max = bounds ? bounds[idx * 2 + 1] : 0;
    const midpoint = (min + max) / 2;

    const origin: [number, number, number] = [0, 0, 0];
    origin[idx] = midpoint;
    const normal = _normalForAxis(axis);

    if (clipPlaneRef.current) {
      clipPlaneRef.current.setOrigin(origin[0], origin[1], origin[2]);
      clipPlaneRef.current.setNormal(normal[0], normal[1], normal[2]);
    } else {
      const plane = vtkPlane.newInstance({ origin, normal });
      clipPlaneRef.current = plane;
      actorsRef.current.forEach(({ mapper }) => {
        if (typeof mapper.addClippingPlane === 'function') {
          mapper.addClippingPlane(plane);
        }
      });
    }
    scene.renderWindow.render();
  }, []);

  const setClipPlanePosition = useCallback((value: number) => {
    const scene = sceneRef.current;
    const plane = clipPlaneRef.current;
    if (!scene || !plane) return;
    const idx = AXIS_INDEX[clipAxisRef.current];
    const origin: [number, number, number] = [0, 0, 0];
    origin[idx] = value;
    plane.setOrigin(origin[0], origin[1], origin[2]);
    scene.renderWindow.render();
  }, []);

  const getClipPlaneRange = useCallback(
    (axis: ClipAxis = clipAxisRef.current): [number, number] | null => {
      const bounds = boundsRef.current;
      if (!bounds) return null;
      const idx = AXIS_INDEX[axis];
      return [bounds[idx * 2], bounds[idx * 2 + 1]];
    },
    [],
  );

  return {
    containerRef,
    loadVtp,
    setVisibility,
    setOpacity,
    setColor,
    resetCamera,
    isReady,
    enableClipPlane,
    setClipPlanePosition,
    getClipPlaneRange,
  };
}
