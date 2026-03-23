import { init as initCornerstoneCore, isCornerstoneInitialized, imageLoader, metaData, getWebWorkerManager } from '@cornerstonejs/core';
import * as cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';

// Re-export for use in other modules
export { metaData, cornerstoneDICOMImageLoader };

// Path to our pre-bundled Cornerstone worker (in public folder)
const WORKER_BUNDLE_PATH = '/workers/cornerstone-decode-worker.bundle.js';
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

// Fallback metadata provider for missing DICOM attributes required by Volume rendering.
// Registered with very low priority so it only runs after all other providers.
const fallbackMetadataProvider = (type: string, _imageId: string) => {
  // Only provide fallbacks for imagePlaneModule (required for Volume rendering)
  if (type !== 'imagePlaneModule') {
    return undefined;
  }
  
  // Return sensible defaults for missing fields.
  // These will only be used if no other provider returned data.
  return {
    pixelSpacing: [1, 1],
    imageOrientationPatient: [1, 0, 0, 0, 1, 0],
    imagePositionPatient: [0, 0, 0],
    sliceThickness: 1,
    sliceLocation: 0,
    frameOfReferenceUID: '',
    rowCosines: [1, 0, 0],
    columnCosines: [0, 1, 0],
    rowPixelSpacing: 1,
    columnPixelSpacing: 1,
  };
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
    // Initialize the DICOM image loader with custom worker configuration
    // We use our pre-bundled worker from the public folder because Vite doesn't
    // properly handle the worker files from node_modules
    
    // Set options using internal API (without calling default init which uses broken worker URL)
    if (cornerstoneDICOMImageLoader.internal?.setOptions) {
      cornerstoneDICOMImageLoader.internal.setOptions({});
    }

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
    
    // Register fallback provider with very low priority (high number = runs last, after DICOM loaders)
    // This provides default values for missing metadata required by Volume rendering
    metaData.addProvider(fallbackMetadataProvider, 10000);
    log('[cornerstone] fallback metadata provider registered with low priority');
    
    // Register image loaders
    if (cornerstoneDICOMImageLoader.wadors?.loadImage) {
      imageLoader.registerImageLoader('wadors', cornerstoneDICOMImageLoader.wadors.loadImage);
      log('[cornerstone] wadors image loader registered');
    }
    
    if (cornerstoneDICOMImageLoader.wadouri?.loadImage) {
      imageLoader.registerImageLoader('wadouri', cornerstoneDICOMImageLoader.wadouri.loadImage);
      log('[cornerstone] wadouri image loader registered');
    }
    
    // Register our custom pre-bundled worker with the worker manager
    // This worker is bundled by scripts/bundle-cornerstone-worker.mjs
    const workerManager = getWebWorkerManager();
    const maxWorkers = navigator.hardwareConcurrency 
      ? Math.max(1, Math.floor(navigator.hardwareConcurrency / 2))
      : 2;
    
    // Create worker factory function that uses our bundled worker
    const workerFn = () => {
      log('[cornerstone] Creating worker from:', WORKER_BUNDLE_PATH);
      return new Worker(WORKER_BUNDLE_PATH, { type: 'module' });
    };
    
    workerManager.registerWorker('dicomImageLoader', workerFn, {
      maxWorkerInstances: maxWorkers,
    });
    
    log('[cornerstone] DICOM image loader initialized with', maxWorkers, 'workers');
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
    log('[cornerstone] Fetching metadata from:', metadataUrl);
    
    const response = await fetch(metadataUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`);
    }
    
    const metadata = await response.json();
    
    // The metadata response is an array with one object for the instance
    const instanceMetadata = Array.isArray(metadata) ? metadata[0] : metadata;
    
    if (instanceMetadata && cornerstoneDICOMImageLoader.wadors?.metaDataManager) {
      // Register metadata for each frame
      for (let frame = 1; frame <= numberOfFrames; frame++) {
        const imageId = buildWadorsImageId(studyId, seriesId, instanceId, frame);
        cornerstoneDICOMImageLoader.wadors.metaDataManager.add(imageId, instanceMetadata);
      }
      log('[cornerstone] Metadata pre-fetched for', instanceId, `(${numberOfFrames} frames)`);
    } else {
      console.warn('[cornerstone] No metaDataManager available or no metadata');
    }
  } catch (err) {
    console.error('[cornerstone] Failed to prefetch metadata:', err);
  }
};
