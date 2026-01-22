import { useEffect, useRef } from 'react';
import { Enums, imageLoader } from '@cornerstonejs/core';

interface StackPrefetchOptions {
  enabled: boolean;
  imageIds: string[];
  currentFrame: number;
  totalFrames: number;
  delayMs?: number;
}

export const useStackPrefetch = ({
  enabled,
  imageIds,
  currentFrame,
  totalFrames,
  delayMs = 150,
}: StackPrefetchOptions) => {
  const prefetchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || imageIds.length === 0) {
      return;
    }

    if (prefetchTimeoutRef.current !== null) {
      clearTimeout(prefetchTimeoutRef.current);
    }

    prefetchTimeoutRef.current = window.setTimeout(() => {
      const radius = Math.min(6, Math.max(2, Math.floor(totalFrames / 20)));
      const start = Math.max(0, currentFrame - radius);
      const end = Math.min(totalFrames - 1, currentFrame + radius);
      const prefetchIds: string[] = [];

      for (let index = start; index <= end; index += 1) {
        if (index === currentFrame) continue;
        const imageId = imageIds[index];
        if (imageId) {
          prefetchIds.push(imageId);
        }
      }

      if (prefetchIds.length === 0) {
        return;
      }

      prefetchIds.forEach((imageId) => {
        imageLoader
          .loadAndCacheImage(imageId, {
            requestType: Enums.RequestType.Prefetch,
            priority: 0,
          })
          .catch(() => {
            // Ignore prefetch failures to keep UI responsive.
          });
      });
    }, delayMs);

    return () => {
      if (prefetchTimeoutRef.current !== null) {
        clearTimeout(prefetchTimeoutRef.current);
        prefetchTimeoutRef.current = null;
      }
    };
  }, [currentFrame, delayMs, enabled, imageIds, totalFrames]);
};
