import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { StackViewport } from '@cornerstonejs/core';
import { Enums as ToolEnums, ToolGroupManager } from '@cornerstonejs/tools';
import { cornerstoneToolNames } from '@/services/cornerstone';
import type { ViewerToolId } from '@/types/viewer';
import type { WindowLevelPreset } from '@/config/viewer';

const toolNameMap: Record<ViewerToolId, string> = {
  zoom: cornerstoneToolNames.zoom,
  pan: cornerstoneToolNames.pan,
  measure: cornerstoneToolNames.length,
  windowLevel: cornerstoneToolNames.windowLevel,
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
    (tool: ViewerToolId) => {
      const toolGroup = toolGroupRef.current;
      if (!toolGroup) {
        return;
      }

      const selectedTool = toolNameMap[tool];
      Object.values(toolNameMap).forEach((toolName) => {
        if (toolName === selectedTool) {
          toolGroup.setToolActive(toolName, {
            bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
          });
        } else {
          toolGroup.setToolPassive(toolName, { removeAllBindings: true });
        }
      });

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
