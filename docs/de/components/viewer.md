# Viewer Komponenten

## DicomViewer

Rolle:

- DICOM-Canvas mit Cornerstone3D (WebGL, 16-bit)
- Tool-Toolbar (Zoom, Pan, Measure, W/L)
- Frame Navigation (Keyboard, Mouse Wheel, Thumbnails)
- Status Overlay (ASR, AI, QA)
- Viewport State Callbacks für Synchronisierung
- Annotation Mode für Training-Daten-Erfassung

Status:

- Cornerstone Stack-Viewer aktiv (DICOMweb WADO-RS)
- Tools: Zoom/Pan/Measure/W-L
- W/L Presets + Prefetch aktiv
- Annotation Export (JSON)
- Viewport-State-Sharing (Zoom, Pan, Window/Level)
- Implementierung modularisiert (Hooks fuer Stack Setup, Prefetch, Sync, Reset)
- Annotation Mode mit Label-Dialog und Panel-Integration

Implementierung:

- `useDicomSeriesInstances`: DICOMweb Instances -> ImageIds/ImageRefs
- `useCornerstoneStackViewport`: Cornerstone RenderingEngine + Viewport Setup
- `useCornerstoneStackSetup`: Stack setzen + Initial-VOI + Tool-Aktivierung
- `useCornerstoneViewerTools`: Tool-Selection + Window/Level Presets
- `useStackFrameNavigation`: Frame-Wechsel + Requested Frame Sync
- `useStackPrefetch`: Prefetch nahe Frames
- `useApplyViewportSyncState`: Externe Sync-State Anwendung
- `useViewerReset`: Reset-Logik fuer Viewport/Tool/WL
- `useAnnotationMode`: Annotation-Tool-Events und Speicherung
- Viewer-Konfiguration in `src/config/viewer.ts` (Tools + Presets)
- Debug-Logs via `VITE_DEBUG_CORNERSTONE=true`

Props:

- `series`: Aktive DICOM-Serie
- `progress`: ASR/AI/QA Status Overlay
- `onFrameChange`: Callback bei Frame-Wechsel
- `onViewportChange`: Callback bei Viewport-Änderungen (Zoom, Pan, W/L)
- `syncState`: Externer Viewport-State für Synchronisierung
- `onImageRefsChange`: Liefert ImageRefs fuer Evidenz/AI
- `requestedFrameIndex`: Externes Frame-Springen (z.B. Evidence)
- `showAnnotationPanel`: AnnotationPanel anzeigen bei Annotation-Modus

## MPRViewer

Rolle:

- Multi-Planar Rekonstruktion (Axial, Sagittal, Coronal)
- 3D-Volumen-Rendering mit Cornerstone3D VolumeViewport
- Crosshair-Navigation für synchronisierte Ebenen
- Slab-Thickness mit MIP/MinIP/Average Projektion

Features:

- **2x2 Layout**: Drei orthogonale Ansichten + Info-Panel
- **Crosshairs Tool**: Klicken positioniert alle drei Ansichten
- **Farbkodierte Referenzlinien**: Rot (Axial), Grün (Sagittal), Blau (Coronal)
- **Maximieren**: Einzelne Ansicht auf Vollbild
- **W/L Presets**: CT-optimierte Fensterung
- **Slab/MIP Rendering**:
  - MIP (Maximum Intensity Projection): Gefäße, Knochen
  - MinIP (Minimum Intensity Projection): Lunge, Atemwege
  - Average: Rauschreduktion
  - Einstellbare Schichtdicke (0-100mm)

Implementierung:

- `useMPRVolumeViewport`: Volume-Loading, Viewport-Setup, Slab-Kontrolle
- `MPRViewport`: Einzelne Ansicht mit Orientierungs-Markern + Slab-Indikator
- `MPRToolbar`: Tool-Auswahl, Layout-Kontrolle, Slab-Settings Popover
- Aktivierung via **MPR**-Button (nur für CT/MR/PT, **≥10 Frames** erforderlich)

Controls:

- **LMB**: Crosshairs (Position in allen Ansichten)
- **RMB**: Pan
- **Scroll**: Zoom
- **Shift+LMB**: Window/Level
- **1 / 2 / 3**: Axial / Sagittal / Coronal maximieren (zurück ins Grid togglen)
- **M**: MIP umschalten (setzt bei Bedarf eine Standard-Schichtdicke)
- **Esc**: Reset (Tool, Preset, Slab-Settings)

## VRTViewer (3D Volume Rendering)

Rolle:

- 3D Volume Rendering mit Transfer Functions
- CT-optimierte Presets (Bone, Lung, Soft Tissue, Angiography)
- Interaktive Beleuchtungs- und Qualitätseinstellungen

Features:

- **CT Presets**: Bone, Lung, Soft Tissue, Angiography, Muscle/Bone
- **Transfer Functions**: Opacity + Color basierend auf Hounsfield Units
- **Beleuchtung**: Ambient, Diffuse, Specular, Glanzstärke
- **Ansichtspositionen**: Anterior, Posterior, Left, Right, Superior, Inferior
- **Renderqualität**: Einstellbare Sample-Distanz

Implementierung:

- `useVRTViewport`: VolumeViewport3D Setup mit Transfer Functions
- `VRTToolbar`: Preset-Auswahl, Ansichtswinkel, Beleuchtungs-Popover
- `src/types/vrt.ts`: VRT Presets und Transfer Function Definitionen
- Aktivierung via **3D**-Button (nur für CT/MR/PT, **≥10 Frames** erforderlich)

Controls:

- **LMB**: Trackball Rotation
- **RMB**: Pan
- **Scroll**: Zoom
- **1–5**: Presets (Bone, Lung, Soft Tissue, Angiography, Muscle/Bone)
- **A / P / L / R / S / I**: Ansichtswinkel (Anterior/Posterior/Left/Right/Superior/Inferior)
- **Esc**: Reset (Kamera + Settings)

## MeshViewer (Segmentierungs-Meshes)

Rolle:

- 3D-Mesh-Viewer für Segmentierungs-Outputs (vtk.js)
- Mehrere anatomische Labels durchsuchen und ein-/ausblenden
- Optionaler DICOM-SEG Export zurück nach Orthanc („An PACS senden“)

Aktivierung:

- Verfügbar via **Mesh**-Button nur für **CT** und typischerweise erst ab **≥30 Frames** (volumetrische CT-Serie).

Features:

- **Presets**: `bone` (schnell) und `total` (multi-organ)
- **Lazy Loading**: initial Top-N Labels, weitere Meshes erst beim Aktivieren nachladen
- **Label-Panel**: Suche, Sortierung (Volumen/Name), Minimum-Volumen-Filter, pro Label Sichtbarkeit/Opacity/Farbe
- **Clip-Plane**: Szene entlang X/Y/Z schneiden, Positions-Slider in mm
- **An PACS senden**: Button erscheint nur, wenn ein DICOM SEG erzeugt wurde (`manifest.dicom_seg`)

Implementierung:

- `MeshViewer`: UI + Job-Lifecycle (Polling) + Label-State
- `useMeshScene`: vtk.js Szene, Mesh-Loading (VTP), Clip-Plane
- `useSegmentation` / `segmentationClient`: Backend-Integration (`/api/v1/segmentation/...`)

Siehe auch: [3D-Segmentierung & Mesh-Viewer](segmenter.md)

## ComparisonViewer

Rolle:

- Side-by-Side Vergleich von aktueller Studie und Voruntersuchungen
- Split-View mit zwei DicomViewer Instanzen
- Synchronisierungsoptionen für bidirektionales Linking

Features:

- **Prior Study Auswahl**: Dropdown für Studie und Serie
- **Swap Views**: Layout tauschen (Aktuell ↔ Prior)
- **Frame Sync**: Proportionale Frame-Synchronisierung
- **Viewport Sync**: Optionale Synchronisierung von:
  - Zoom (parallelScale)
  - Pan (Focal Point)
  - Window/Level (VOI Range)
- **MPR Toggle**: Umschalten zwischen Stack- und MPR-Ansicht

Status:

- Vollständig implementiert
- Bidirektionale Sync via `useViewportSync` (60fps throttle)

## ImageControls

Toolbar fuer Viewer Tools. Aktiviert Tools per Shortcuts (Z/P/M/W).

## SeriesStack

Thumbnail-Stack (frames). Erlaubt schnelles Navigieren per Klick.

## ProgressOverlay

Anzeige von:

- ASR Status (idle/listening/processing)
- AI Status (idle/generating/error)
- QA Status (pending/checking/pass/warn/fail)
