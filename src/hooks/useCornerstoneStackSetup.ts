import { useEffect, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { StackViewport } from '@cornerstonejs/core';
import type { AllToolId } from '@/types/viewer';

interface UseCornerstoneStackSetupOptions {
  isReady: boolean;
  imageIds: string[];
  stackViewportRef: MutableRefObject<StackViewport | null>;
  initialParallelScaleRef: MutableRefObject<number | null>;
  activeToolRef: RefObject<AllToolId>;
  selectedPresetId: string;
  applyToolSelection: (tool: AllToolId) => void;
  applyWindowLevelPreset: (presetId: string) => void;
  onError?: (message: string | null) => void;
}

export const useCornerstoneStackSetup = ({
  isReady,
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
    if (!isReady || !viewport || imageIds.length === 0) {
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
    isReady,
    initialParallelScaleRef,
    onError,
    selectedPresetId,
    stackViewportRef,
  ]);

  return { isInitializing };
};
