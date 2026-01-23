import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { StackViewport } from '@cornerstonejs/core';
import { Enums as ToolEnums, ToolGroupManager } from '@cornerstonejs/tools';
import { cornerstoneToolNames } from '@/services/cornerstone';
import type { ViewerToolId, AnnotationToolId, AllToolId } from '@/types/viewer';
import type { WindowLevelPreset } from '@/config/viewer';

// Map viewer tool IDs to Cornerstone tool names
const viewerToolNameMap: Record<ViewerToolId, string> = {
  zoom: cornerstoneToolNames.zoom,
  pan: cornerstoneToolNames.pan,
  measure: cornerstoneToolNames.length,
  windowLevel: cornerstoneToolNames.windowLevel,
};

// Map annotation tool IDs to Cornerstone tool names
const annotationToolNameMap: Record<AnnotationToolId, string> = {
  rectangle: cornerstoneToolNames.rectangle,
  ellipse: cornerstoneToolNames.ellipse,
  freehand: cornerstoneToolNames.freehand,
  bidirectional: cornerstoneToolNames.bidirectional,
  arrow: cornerstoneToolNames.arrow,
};

// Combined map
const allToolNameMap: Record<AllToolId, string> = {
  ...viewerToolNameMap,
  ...annotationToolNameMap,
};

interface UseCornerstoneViewerToolsOptions {
  toolGroupRef: RefObject<ReturnType<typeof ToolGroupManager.getToolGroup> | null>;
  stackViewportRef: RefObject<StackViewport | null>;
  presets: WindowLevelPreset[];
}

export const useCornerstoneViewerTools = ({
  toolGroupRef,
  stackViewportRef,
  presets,
}: UseCornerstoneViewerToolsOptions) => {
  const applyToolSelection = useCallback(
    (tool: AllToolId) => {
      const toolGroup = toolGroupRef.current;
      if (!toolGroup) {
        return;
      }

      const selectedTool = allToolNameMap[tool];
      if (!selectedTool) {
        console.warn(`[useCornerstoneViewerTools] Unknown tool: ${tool}`);
        return;
      }

      // Set all tools passive first
      Object.values(allToolNameMap).forEach((toolName) => {
        try {
          if (toolName === selectedTool) {
            toolGroup.setToolActive(toolName, {
              bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
            });
          } else {
            toolGroup.setToolPassive(toolName, { removeAllBindings: true });
          }
        } catch {
          // Tool may not be added to this group
        }
      });

      // Always keep stack scroll active on wheel
      toolGroup.setToolActive(cornerstoneToolNames.stackScroll, {
        bindings: [{ mouseButton: ToolEnums.MouseBindings.Wheel }],
      });
    },
    [toolGroupRef]
  );

  const applyWindowLevelPreset = useCallback(
    (presetId: string) => {
      const viewport = stackViewportRef.current;
      if (!viewport) {
        return;
      }

      // Ensure an image is loaded before trying to apply window/level settings
      // Otherwise Cornerstone throws: Cannot destructure property 'windowCenter' of 'this.csImage'
      const currentImageId = viewport.getCurrentImageId?.();
      if (!currentImageId) {
        return;
      }

      if (presetId === 'auto') {
        viewport.resetProperties();
        viewport.render();
        return;
      }

      const preset = presets.find((item) => item.id === presetId);
      if (!preset || preset.windowWidth === undefined || preset.windowCenter === undefined) {
        return;
      }

      const halfWidth = preset.windowWidth / 2;
      viewport.setProperties({
        voiRange: {
          lower: preset.windowCenter - halfWidth,
          upper: preset.windowCenter + halfWidth,
        },
      });
      viewport.render();
    },
    [presets, stackViewportRef]
  );

  return { applyToolSelection, applyWindowLevelPreset };
};
