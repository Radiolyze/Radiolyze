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
        console.log('[useCornerstoneStackSetup] Setting up stack with', imageIds.length, 'images');
        console.log('[useCornerstoneStackSetup] First image ID:', imageIds[0]);
        
        applyToolSelection(activeToolRef.current);
        
        console.log('[useCornerstoneStackSetup] Calling setStack...');
        await viewport.setStack(imageIds, 0);
        console.log('[useCornerstoneStackSetup] setStack complete, calling render...');
        
        viewport.render();
        console.log('[useCornerstoneStackSetup] render complete');

        applyWindowLevelPreset(selectedPresetId);

        const camera = viewport.getCamera();
        if (isActive) {
          initialParallelScaleRef.current = camera?.parallelScale ?? null;
          console.log('[useCornerstoneStackSetup] Stack setup complete, parallelScale:', camera?.parallelScale);
        }
      } catch (error) {
        console.error('[useCornerstoneStackSetup] Stack setup failed:', error);
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
