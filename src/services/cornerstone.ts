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

// Build auth headers for DICOMweb requests
const getAuthHeaderValue = (): string | null => {
  const username = import.meta.env.VITE_DICOM_WEB_USERNAME;
  const password = import.meta.env.VITE_DICOM_WEB_PASSWORD;
  if (!username || !password) {
    return null;
  }
  return `Basic ${btoa(`${username}:${password}`)}`;
};

export const initCornerstone = async () => {
  if (initialized) {
    return;
  }

  if (!isCornerstoneInitialized()) {
    initCornerstoneCore();
  }

  try {
    const authHeader = getAuthHeaderValue();
    
    // Log available methods on dicom-image-loader for debugging
    console.log('[cornerstone] dicom-image-loader exports:', Object.keys(cornerstoneDICOMImageLoader));
    if (cornerstoneDICOMImageLoader.wadors) {
      console.log('[cornerstone] wadors methods:', Object.keys(cornerstoneDICOMImageLoader.wadors));
    }
    
    // Initialize the DICOM image loader (v4 API)
    // Disable web workers to avoid CSP issues in development
    cornerstoneDICOMImageLoader.init({
      maxWebWorkers: 0,
    });

    // Configure global XHR settings for authentication using the configure function if available
    if (authHeader && typeof cornerstoneDICOMImageLoader.configure === 'function') {
      cornerstoneDICOMImageLoader.configure({
        beforeSend: (xhr: XMLHttpRequest) => {
          xhr.setRequestHeader('Authorization', authHeader);
        },
      });
      console.log('[cornerstone] Global auth headers configured');
    }

    // Register image loaders
    if (cornerstoneDICOMImageLoader.wadors?.loadImage) {
      imageLoader.registerImageLoader('wadors', cornerstoneDICOMImageLoader.wadors.loadImage);
      console.log('[cornerstone] wadors loader registered');
    }
    
    if (cornerstoneDICOMImageLoader.wadouri?.loadImage) {
      imageLoader.registerImageLoader('wadouri', cornerstoneDICOMImageLoader.wadouri.loadImage);
      console.log('[cornerstone] wadouri loader registered');
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
