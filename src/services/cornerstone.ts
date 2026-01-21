import { init as initCornerstoneCore, isCornerstoneInitialized } from '@cornerstonejs/core';
import {
  addTool,
  init as initCornerstoneTools,
  LengthTool,
  PanTool,
  StackScrollTool,
  WindowLevelTool,
  ZoomTool,
} from '@cornerstonejs/tools';

let initialized = false;

export const cornerstoneToolNames = {
  pan: PanTool.toolName,
  zoom: ZoomTool.toolName,
  windowLevel: WindowLevelTool.toolName,
  length: LengthTool.toolName,
  stackScroll: StackScrollTool.toolName,
};

export const initCornerstone = async () => {
  if (initialized) {
    return;
  }

  if (!isCornerstoneInitialized()) {
    initCornerstoneCore();
  }

  const maxWebWorkers =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? Math.max(1, Math.floor(navigator.hardwareConcurrency / 2))
      : 1;

  try {
    // Dynamic import to avoid the star export resolution issue
    const dicomImageLoader = await import('@cornerstonejs/dicom-image-loader');
    if (dicomImageLoader.init) {
      dicomImageLoader.init({ maxWebWorkers });
    } else if (dicomImageLoader.default?.init) {
      dicomImageLoader.default.init({ maxWebWorkers });
    }
  } catch (err) {
    console.warn('[cornerstone] DICOM image loader init skipped:', err);
  }

  initCornerstoneTools();

  addTool(PanTool);
  addTool(ZoomTool);
  addTool(WindowLevelTool);
  addTool(LengthTool);
  addTool(StackScrollTool);

  initialized = true;
};
