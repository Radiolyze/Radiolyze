import { init as initCornerstoneCore, isCornerstoneInitialized, imageLoader } from '@cornerstonejs/core';
import * as cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
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
    // Initialize the DICOM image loader (v4 API - no external dependencies needed)
    cornerstoneDICOMImageLoader.init({
      maxWebWorkers,
    });

    // Register the wadors image loader for DICOMweb
    if (cornerstoneDICOMImageLoader.wadors?.loadImage) {
      imageLoader.registerImageLoader('wadors', cornerstoneDICOMImageLoader.wadors.loadImage);
    }
    
    // Also register wadouri loader for local files
    if (cornerstoneDICOMImageLoader.wadouri?.loadImage) {
      imageLoader.registerImageLoader('wadouri', cornerstoneDICOMImageLoader.wadouri.loadImage);
    }
    
    console.log('[cornerstone] DICOM image loader initialized successfully');
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
