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

  try {
    // Initialize the DICOM image loader (v4 API)
    // Note: Auth is handled by Vite proxy, so no client-side auth config needed
    cornerstoneDICOMImageLoader.init({
      maxWebWorkers: 0, // Disable web workers to avoid CSP issues
    });

    // Register metadata providers with cornerstone core
    // This is required for wadors to resolve metadata when loading images
    if (cornerstoneDICOMImageLoader.wadors?.register) {
      cornerstoneDICOMImageLoader.wadors.register();
      console.log('[cornerstone] wadors metadata provider registered');
    }
    
    if (cornerstoneDICOMImageLoader.wadouri?.register) {
      cornerstoneDICOMImageLoader.wadouri.register();
      console.log('[cornerstone] wadouri metadata provider registered');
    }
    
    // Register image loaders
    if (cornerstoneDICOMImageLoader.wadors?.loadImage) {
      imageLoader.registerImageLoader('wadors', cornerstoneDICOMImageLoader.wadors.loadImage);
      console.log('[cornerstone] wadors image loader registered');
    }
    
    if (cornerstoneDICOMImageLoader.wadouri?.loadImage) {
      imageLoader.registerImageLoader('wadouri', cornerstoneDICOMImageLoader.wadouri.loadImage);
      console.log('[cornerstone] wadouri image loader registered');
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
