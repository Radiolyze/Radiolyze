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
- Aktivierung via MPR-Button (nur für CT/MR mit ≥10 Frames)

Controls:

- **LMB**: Crosshairs (Position in allen Ansichten)
- **RMB**: Pan
- **Scroll**: Zoom
- **Shift+LMB**: Window/Level

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
