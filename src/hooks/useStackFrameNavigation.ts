import { useCallback, useEffect } from 'react';
import type { RefObject, Dispatch, SetStateAction } from 'react';
import type { StackViewport } from '@cornerstonejs/core';

interface StackFrameNavigationOptions {
  currentFrame: number;
  setCurrentFrame: Dispatch<SetStateAction<number>>;
  hasStack: boolean;
  totalFrames: number;
  stackViewportRef: RefObject<StackViewport | null>;
  requestedFrameIndex?: number | null;
  onFrameChange?: (frame: number, total: number) => void;
}

interface StackFrameNavigationResult {
  setFrameIndex: (index: number) => void;
  handlePrevFrame: () => void;
  handleNextFrame: () => void;
}

export const useStackFrameNavigation = ({
  currentFrame,
  setCurrentFrame,
  hasStack,
  totalFrames,
  stackViewportRef,
  requestedFrameIndex,
  onFrameChange,
}: StackFrameNavigationOptions): StackFrameNavigationResult => {
  const setFrameIndex = useCallback(
    (index: number) => {
      if (!hasStack) {
        setCurrentFrame(0);
        return;
      }

      const nextIndex = Math.max(0, Math.min(index, totalFrames - 1));
      setCurrentFrame(nextIndex);

      const viewport = stackViewportRef.current;
      if (viewport) {
        viewport.setImageIdIndex(nextIndex).catch((error) => {
          console.warn('Failed to change frame', error);
        });
      }
    },
    [hasStack, stackViewportRef, totalFrames]
  );

  useEffect(() => {
    if (typeof requestedFrameIndex !== 'number') {
      return;
    }
    if (requestedFrameIndex === currentFrame) {
      return;
    }
    setFrameIndex(requestedFrameIndex);
  }, [currentFrame, requestedFrameIndex, setFrameIndex]);

  useEffect(() => {
    onFrameChange?.(currentFrame, totalFrames);
  }, [currentFrame, totalFrames, onFrameChange]);

  const handlePrevFrame = useCallback(() => {
    setFrameIndex(currentFrame - 1);
  }, [currentFrame, setFrameIndex]);

  const handleNextFrame = useCallback(() => {
    setFrameIndex(currentFrame + 1);
  }, [currentFrame, setFrameIndex]);

  return { setFrameIndex, handlePrevFrame, handleNextFrame };
};
