import { useCallback } from "react";
import type { RefObject, Dispatch, SetStateAction } from "react";
import type { StackViewport } from "@cornerstonejs/core";
import type { ViewerToolId } from "@/types/viewer";
import { logger } from "@/lib/logger";

interface UseViewerResetOptions {
  stackViewportRef: RefObject<StackViewport | null>;
  /**
   * Reset only ever sets a tool outright, never via the updater form, so this
   * asks for a plain setter rather than a full `Dispatch<SetStateAction<…>>`.
   * That lets a caller holding a setter for a wider tool union pass it in.
   */
  setActiveTool: (tool: ViewerToolId) => void;
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
    setActiveTool("windowLevel");
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
      } catch (err) {
        // Image data not yet loaded
        logger.debug("[useViewerReset] Failed to reset properties", err);
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
