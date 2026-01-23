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
  RectangleROITool,
  EllipticalROITool,
  PlanarFreehandROITool,
  BidirectionalTool,
  ArrowAnnotateTool,
  TrackballRotateTool,
} from '@cornerstonejs/tools';

let initialized = false;
const shouldDebug = import.meta.env.VITE_DEBUG_CORNERSTONE === 'true';
const log = (...args: Parameters<typeof console.log>) => {
  if (shouldDebug) {
    console.log(...args);
  }
};

export const cornerstoneToolNames = {
  // Navigation tools
  pan: PanTool.toolName,
  zoom: ZoomTool.toolName,
  windowLevel: WindowLevelTool.toolName,
  length: LengthTool.toolName,
  stackScroll: StackScrollTool.toolName,
  // 3D tools
  trackballRotate: TrackballRotateTool.toolName,
  // Annotation tools for training
  rectangle: RectangleROITool.toolName,
  ellipse: EllipticalROITool.toolName,
  freehand: PlanarFreehandROITool.toolName,
  bidirectional: BidirectionalTool.toolName,
  arrow: ArrowAnnotateTool.toolName,
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
    // Workers are enabled for better performance - CSP headers configured in vite.config.ts
    cornerstoneDICOMImageLoader.init({
      maxWebWorkers: navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 2,
    });

    // Register metadata providers with cornerstone core
    // This is required for wadors to resolve metadata when loading images
    if (cornerstoneDICOMImageLoader.wadors?.register) {
      cornerstoneDICOMImageLoader.wadors.register();
      log('[cornerstone] wadors metadata provider registered');
    }
    
    if (cornerstoneDICOMImageLoader.wadouri?.register) {
      cornerstoneDICOMImageLoader.wadouri.register();
      log('[cornerstone] wadouri metadata provider registered');
    }
    
    // Register image loaders
    if (cornerstoneDICOMImageLoader.wadors?.loadImage) {
      imageLoader.registerImageLoader('wadors', cornerstoneDICOMImageLoader.wadors.loadImage);
      log('[cornerstone] wadors image loader registered');
    }
    
    if (cornerstoneDICOMImageLoader.wadouri?.loadImage) {
      imageLoader.registerImageLoader('wadouri', cornerstoneDICOMImageLoader.wadouri.loadImage);
      log('[cornerstone] wadouri image loader registered');
    }
    
    log('[cornerstone] DICOM image loader initialized successfully');
  } catch (err) {
    console.warn('[cornerstone] DICOM image loader init skipped:', err);
  }

  initCornerstoneTools();

  // Navigation tools
  addTool(PanTool);
  addTool(ZoomTool);
  addTool(WindowLevelTool);
  addTool(LengthTool);
  addTool(StackScrollTool);

  // Annotation tools for training data
  addTool(RectangleROITool);
  addTool(EllipticalROITool);
  addTool(PlanarFreehandROITool);
  addTool(BidirectionalTool);
  addTool(ArrowAnnotateTool);

  // 3D tools
  addTool(TrackballRotateTool);

  log('[cornerstone] All tools registered (navigation + annotation + 3D)');

  initialized = true;
};
