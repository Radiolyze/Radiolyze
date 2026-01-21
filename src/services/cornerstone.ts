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
import * as dicomImageLoader from '@cornerstonejs/dicom-image-loader';

let initialized = false;

export const cornerstoneToolNames = {
  pan: PanTool.toolName,
  zoom: ZoomTool.toolName,
  windowLevel: WindowLevelTool.toolName,
  length: LengthTool.toolName,
  stackScroll: StackScrollTool.toolName,
};

export const initCornerstone = () => {
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

  dicomImageLoader.init({ maxWebWorkers });
  initCornerstoneTools();

  addTool(PanTool);
  addTool(ZoomTool);
  addTool(WindowLevelTool);
  addTool(LengthTool);
  addTool(StackScrollTool);

  initialized = true;
};
