# Viewer Components

## DicomViewer

Role:

- DICOM canvas using Cornerstone3D (WebGL, 16-bit)
- Tool toolbar (Zoom, Pan, Measure, W/L)
- Frame navigation (keyboard, mouse wheel, thumbnails)
- Status overlay (ASR, AI, QA)
- Viewport state callbacks for synchronisation
- Annotation mode for training data capture

Status:

- Cornerstone stack viewer active (DICOMweb WADO-RS)
- Tools: Zoom/Pan/Measure/W-L
- W/L presets + prefetch active
- Annotation export (JSON)
- Viewport state sharing (zoom, pan, window/level)
- Implementation modularised (hooks for stack setup, prefetch, sync, reset)
- Annotation mode with label dialog and panel integration

Implementation:

- `useDicomSeriesInstances`: DICOMweb instances -> ImageIds/ImageRefs
- `useCornerstoneStackViewport`: Cornerstone RenderingEngine + viewport setup
- `useCornerstoneStackSetup`: Set stack + initial VOI + tool activation
- `useCornerstoneViewerTools`: Tool selection + window/level presets
- `useStackFrameNavigation`: Frame switching + requested frame sync
- `useStackPrefetch`: Prefetch nearby frames
- `useApplyViewportSyncState`: Apply external sync state
- `useViewerReset`: Reset logic for viewport/tool/WL
- `useAnnotationMode`: Annotation tool events and persistence
- Viewer configuration in `src/config/viewer.ts` (tools + presets)
- Debug logs via `VITE_DEBUG_CORNERSTONE=true`

Props:

- `series`: Active DICOM series
- `progress`: ASR/AI/QA status overlay
- `onFrameChange`: Callback on frame change
- `onViewportChange`: Callback on viewport changes (zoom, pan, W/L)
- `syncState`: External viewport state for synchronisation
- `onImageRefsChange`: Provides ImageRefs for evidence/AI
- `requestedFrameIndex`: External frame jump (e.g. evidence)
- `showAnnotationPanel`: Show annotation panel in annotation mode

## MPRViewer

Role:

- Multi-planar reconstruction (axial, sagittal, coronal)
- 3D volume rendering using Cornerstone3D VolumeViewport
- Crosshair navigation for synchronised planes
- Slab thickness with MIP/MinIP/Average projection

Features:

- **2x2 layout**: Three orthogonal views + info panel
- **Crosshairs tool**: Click to position all three views
- **Colour-coded reference lines**: Red (axial), green (sagittal), blue (coronal)
- **Maximise**: Expand a single view to full screen
- **W/L presets**: CT-optimised windowing
- **Slab/MIP rendering**:
  - MIP (Maximum Intensity Projection): vessels, bone
  - MinIP (Minimum Intensity Projection): lung, airways
  - Average: noise reduction
  - Adjustable slab thickness (0–100 mm)

Implementation:

- `useMPRVolumeViewport`: Volume loading, viewport setup, slab control
- `MPRViewport`: Individual view with orientation markers + slab indicator
- `MPRToolbar`: Tool selection, layout control, slab settings popover
- Activated via MPR button (CT/MR only, ≥10 frames required)

Controls:

- **LMB**: Crosshairs (position in all views)
- **RMB**: Pan
- **Scroll**: Zoom
- **Shift+LMB**: Window/Level

## VRTViewer (3D Volume Rendering)

Role:

- 3D volume rendering with transfer functions
- CT-optimised presets (Bone, Lung, Soft Tissue, Angiography)
- Interactive lighting and quality settings

Features:

- **CT presets**: Bone, Lung, Soft Tissue, Angiography, Muscle/Bone
- **Transfer functions**: Opacity + colour based on Hounsfield units
- **Lighting**: Ambient, diffuse, specular, shininess
- **View positions**: Anterior, Posterior, Left, Right, Superior, Inferior
- **Render quality**: Adjustable sample distance

Implementation:

- `useVRTViewport`: VolumeViewport3D setup with transfer functions
- `VRTToolbar`: Preset selection, view angles, lighting popover
- `src/types/vrt.ts`: VRT presets and transfer function definitions
- Activated via 3D button (CT/MR/PT only, ≥10 frames required)

Controls:

- **LMB**: Trackball rotation
- **RMB**: Pan
- **Scroll**: Zoom

## ComparisonViewer

Role:

- Side-by-side comparison of the current study and prior examinations
- Split view with two DicomViewer instances
- Synchronisation options for bidirectional linking

Features:

- **Prior study selection**: Dropdown for study and series
- **Swap views**: Toggle layout (current ↔ prior)
- **Frame sync**: Proportional frame synchronisation
- **Viewport sync**: Optional synchronisation of:
  - Zoom (parallelScale)
  - Pan (focal point)
  - Window/Level (VOI range)
- **MPR toggle**: Switch between stack and MPR view

Status:

- Fully implemented
- Bidirectional sync via `useViewportSync` (60 fps throttle)

## ImageControls

Toolbar for viewer tools. Activates tools via shortcuts (Z/P/M/W).

## SeriesStack

Thumbnail stack (frames). Allows fast navigation by click.

## ProgressOverlay

Displays:

- ASR status (idle/listening/processing)
- AI status (idle/generating/error)
- QA status (pending/checking/pass/warn/fail)
