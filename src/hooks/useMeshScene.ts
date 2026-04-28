import { useCallback, useEffect, useRef, useState } from 'react';
// vtk.js side-effect import: ensure geometry rendering profile is registered.
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';

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

interface UseMeshSceneResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  loadVtp: (labelId: number, data: ArrayBuffer) => void;
  setVisibility: (labelId: number, visible: boolean) => void;
  setOpacity: (labelId: number, opacity: number) => void;
  setColor: (labelId: number, rgb: [number, number, number]) => void;
  resetCamera: () => void;
  isReady: boolean;
}

export function useMeshScene(): UseMeshSceneResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<VtkScene | null>(null);
  const actorsRef = useRef<Map<number, ActorEntry>>(new Map());
  const [isReady, setIsReady] = useState(false);

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
      fullScreen.delete();
      sceneRef.current = null;
      setIsReady(false);
    };
  }, []);

  const loadVtp = useCallback((labelId: number, data: ArrayBuffer) => {
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
    // vtk.js can parse text or arraybuffer; we get an ArrayBuffer from fetch.
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

    scene.renderer.addActor(actor);
    actorsRef.current.set(labelId, { actor, mapper });

    if (actorsRef.current.size === 1) {
      scene.renderer.resetCamera();
    }
    scene.renderWindow.render();
  }, []);

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

  return {
    containerRef,
    loadVtp,
    setVisibility,
    setOpacity,
    setColor,
    resetCamera,
    isReady,
  };
}
