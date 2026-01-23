import { init as initCornerstoneCore, isCornerstoneInitialized, imageLoader, metaData } from '@cornerstonejs/core';
import * as cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';

// Re-export for use in other modules
export { metaData, cornerstoneDICOMImageLoader };
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
    // Disable web workers to avoid Vite bundling issues with worker MIME types
    // This uses main-thread decoding which is slower but more reliable
    cornerstoneDICOMImageLoader.init({
      maxWebWorkers: 0,
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

/**
 * Pre-fetch and register metadata for WADORS images.
 * This must be called before loading images to ensure pixel module data is available.
 * 
 * @param studyId - DICOM Study Instance UID
 * @param seriesId - DICOM Series Instance UID  
 * @param instanceId - DICOM SOP Instance UID
 * @param numberOfFrames - Number of frames in the instance (for multi-frame images)
 */
export const prefetchWadorsMetadata = async (
  studyId: string,
  seriesId: string,
  instanceId: string,
  numberOfFrames = 1
): Promise<void> => {
  // Import dynamically to avoid circular dependency
  const { buildDicomWebUrl, buildWadorsImageId } = await import('@/services/orthancClient');
  
  try {
    const metadataUrl = buildDicomWebUrl(
      `studies/${studyId}/series/${seriesId}/instances/${instanceId}/metadata`
    );
    console.log('[cornerstone] Fetching metadata from:', metadataUrl);
    
    const response = await fetch(metadataUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`);
    }
    
    const metadata = await response.json();
    console.log('[cornerstone] Metadata received, array length:', Array.isArray(metadata) ? metadata.length : 'not array');
    
    // The metadata response is an array with one object for the instance
    const instanceMetadata = Array.isArray(metadata) ? metadata[0] : metadata;
    
    if (instanceMetadata && cornerstoneDICOMImageLoader.wadors?.metaDataManager) {
      // Register metadata for each frame
      for (let frame = 1; frame <= numberOfFrames; frame++) {
        const imageId = buildWadorsImageId(studyId, seriesId, instanceId, frame);
        cornerstoneDICOMImageLoader.wadors.metaDataManager.add(imageId, instanceMetadata);
        console.log('[cornerstone] Registered metadata for:', imageId);
      }
      console.log('[cornerstone] Metadata pre-fetched for', instanceId, `(${numberOfFrames} frames)`);
    } else {
      console.warn('[cornerstone] No metaDataManager available or no metadata');
    }
  } catch (err) {
    console.error('[cornerstone] Failed to prefetch metadata:', err);
  }
};
