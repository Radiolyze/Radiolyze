import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { StackViewport } from '@cornerstonejs/core';
import type { ViewportState } from '@/types/viewerSync';

interface ApplyViewportSyncOptions {
  syncState?: Partial<ViewportState>;
  stackViewportRef: RefObject<StackViewport | null>;
  initialParallelScaleRef: RefObject<number | null>;
  syncingRef: RefObject<boolean>;
}

export const useApplyViewportSyncState = ({
  syncState,
  stackViewportRef,
  initialParallelScaleRef,
  syncingRef,
}: ApplyViewportSyncOptions) => {
  useEffect(() => {
    const viewport = stackViewportRef.current;
    if (!viewport || !syncState) return;

    syncingRef.current = true;

    try {
      const camera = viewport.getCamera();
      const initialScale = initialParallelScaleRef.current;
      let needsRender = false;

      // Apply zoom
      if (syncState.zoom !== undefined && initialScale) {
        const targetParallelScale = initialScale / syncState.zoom;
        if (camera.parallelScale !== targetParallelScale) {
          viewport.setCamera({ ...camera, parallelScale: targetParallelScale });
          needsRender = true;
        }
      }

      // Apply pan using panWorld method (Cornerstone3D approach)
      if (syncState.pan !== undefined) {
        // Pan is applied via camera focal point offset - we use viewport methods
        // For stack viewports, pan is controlled via the camera's focalPoint
        const worldDelta: [number, number, number] = [syncState.pan.x, syncState.pan.y, 0];
        viewport.setCamera({
          ...camera,
          focalPoint: [
            (camera.focalPoint?.[0] ?? 0) + worldDelta[0],
            (camera.focalPoint?.[1] ?? 0) + worldDelta[1],
            camera.focalPoint?.[2] ?? 0,
          ] as [number, number, number],
        });
        needsRender = true;
      }

      // Apply window/level
      if (syncState.windowLevel !== undefined) {
        const halfWidth = syncState.windowLevel.width / 2;
        viewport.setProperties({
          voiRange: {
            lower: syncState.windowLevel.center - halfWidth,
            upper: syncState.windowLevel.center + halfWidth,
          },
        });
        needsRender = true;
      }

      if (needsRender) {
        viewport.render();
      }
    } finally {
      // Reset flag after a small delay to allow events to settle
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    }
  }, [initialParallelScaleRef, stackViewportRef, syncState, syncingRef]);
};
