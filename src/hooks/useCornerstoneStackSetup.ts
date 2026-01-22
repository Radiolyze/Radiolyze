import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { StackViewport } from '@cornerstonejs/core';
import type { ViewerToolId } from '@/types/viewer';

interface UseCornerstoneStackSetupOptions {
  imageIds: string[];
  stackViewportRef: RefObject<StackViewport | null>;
  initialParallelScaleRef: RefObject<number | null>;
  activeToolRef: RefObject<ViewerToolId>;
  selectedPresetId: string;
  applyToolSelection: (tool: ViewerToolId) => void;
  applyWindowLevelPreset: (presetId: string) => void;
  onError?: (message: string | null) => void;
}

export const useCornerstoneStackSetup = ({
  imageIds,
  stackViewportRef,
  initialParallelScaleRef,
  activeToolRef,
  selectedPresetId,
  applyToolSelection,
  applyWindowLevelPreset,
  onError,
}: UseCornerstoneStackSetupOptions) => {
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    const viewport = stackViewportRef.current;
    if (!viewport || imageIds.length === 0) {
      return;
    }

    let isActive = true;

    const setupStack = async () => {
      setIsInitializing(true);
      onError?.(null);

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
          onError?.('Viewer konnte nicht initialisiert werden.');
        }
      } finally {
        if (isActive) {
          setIsInitializing(false);
        }
      }
    };

    setupStack();

    return () => {
      isActive = false;
    };
  }, [
    activeToolRef,
    applyToolSelection,
    applyWindowLevelPreset,
    imageIds,
    initialParallelScaleRef,
    onError,
    selectedPresetId,
    stackViewportRef,
  ]);

  return { isInitializing };
};
