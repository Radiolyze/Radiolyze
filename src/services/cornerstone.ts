import { init as initCornerstoneCore, isCornerstoneInitialized, imageLoader } from '@cornerstonejs/core';
import dicomParser from 'dicom-parser';
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

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/7c9f9a72-f02e-4a63-b1bd-717991ce3f15',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cornerstone.ts:initCornerstone:start',message:'initCornerstone start',data:{initialized,coreInitialized:isCornerstoneInitialized(),maxWebWorkers},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  try {
    // Dynamic import to avoid the star export resolution issue
    const dicomImageLoader = await import('@cornerstonejs/dicom-image-loader');
    const loaderModule =
      'default' in dicomImageLoader ? dicomImageLoader.default ?? dicomImageLoader : dicomImageLoader;

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7c9f9a72-f02e-4a63-b1bd-717991ce3f15',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cornerstone.ts:initCornerstone:import',message:'dicom-image-loader imported',data:{hasDefault:'default' in dicomImageLoader,loaderKeys:Object.keys(loaderModule),hasWadors:Boolean((loaderModule as Record<string, unknown>).wadors),hasInit:Boolean((loaderModule as Record<string, unknown>).init),hasExternal:Boolean((loaderModule as Record<string, unknown>).external)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    if ('external' in loaderModule && loaderModule.external) {
      loaderModule.external.dicomParser = dicomParser;
    }

    if ('init' in loaderModule) {
      loaderModule.init({
        maxWebWorkers,
        startWebWorkersOnDemand: true,
        taskConfiguration: {
          decodeTask: {
            initializeCodecsOnStartup: false,
            strict: false,
          },
        },
      });
    }

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7c9f9a72-f02e-4a63-b1bd-717991ce3f15',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cornerstone.ts:initCornerstone:init',message:'dicom-image-loader init attempted',data:{initCalled:('init' in loaderModule)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    if ('wadors' in loaderModule && loaderModule.wadors?.loadImage) {
      imageLoader.registerImageLoader('wadors', loaderModule.wadors.loadImage);
    }

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7c9f9a72-f02e-4a63-b1bd-717991ce3f15',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cornerstone.ts:initCornerstone:register',message:'wadors loader register attempted',data:{hasWadorsLoadImage:Boolean((loaderModule as Record<string, any>).wadors?.loadImage)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7c9f9a72-f02e-4a63-b1bd-717991ce3f15',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cornerstone.ts:initCornerstone:error',message:'dicom-image-loader init failed',data:{error:err instanceof Error ? {name:err.name,message:err.message} : {message:String(err)}},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
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
