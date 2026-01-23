import { useCallback } from 'react';
import type { RefObject, Dispatch, SetStateAction } from 'react';
import type { StackViewport } from '@cornerstonejs/core';
import type { ViewerToolId } from '@/types/viewer';

interface UseViewerResetOptions {
  stackViewportRef: RefObject<StackViewport | null>;
  setActiveTool: Dispatch<SetStateAction<ViewerToolId>>;
  defaultPresetId: string;
  setSelectedPresetId: Dispatch<SetStateAction<string>>;
  setFrameIndex: (index: number) => void;
  setZoom: Dispatch<SetStateAction<number>>;
}

export const useViewerReset = ({
  stackViewportRef,
  setActiveTool,
  defaultPresetId,
  setSelectedPresetId,
  setFrameIndex,
  setZoom,
}: UseViewerResetOptions) =>
  useCallback(() => {
    setActiveTool('windowLevel');
    setSelectedPresetId(defaultPresetId);
    setFrameIndex(0);

    const viewport = stackViewportRef.current;
    if (viewport) {
      viewport.resetCamera({ resetPan: true, resetZoom: true, resetToCenter: true });
      // Only reset properties if an image is loaded, otherwise Cornerstone throws
      // "Cannot destructure property 'windowCenter' of 'this.csImage'"
      try {
        if (viewport.getCurrentImageId?.()) {
          viewport.resetProperties();
        }
      } catch {
        // Image data not yet loaded
      }
    }

    setZoom(1);
  }, [
    defaultPresetId,
    setActiveTool,
    setFrameIndex,
    setSelectedPresetId,
    setZoom,
    stackViewportRef,
  ]);
