# Viewer Komponenten

## DicomViewer

Rolle:

- DICOM-Canvas mit Cornerstone3D (WebGL, 16-bit)
- Tool-Toolbar (Zoom, Pan, Measure, W/L)
- Frame Navigation (Keyboard, Mouse Wheel, Thumbnails)
- Status Overlay (ASR, AI, QA)
- Viewport State Callbacks für Synchronisierung

Status:

- Cornerstone Stack-Viewer aktiv (DICOMweb WADO-RS)
- Tools: Zoom/Pan/Measure/W-L
- W/L Presets + Prefetch aktiv
- Annotation Export (JSON)
- Viewport-State-Sharing (Zoom, Pan, Window/Level)
- Implementierung modularisiert (Hooks fuer Stack Setup, Prefetch, Sync, Reset)

Implementierung:

- `useDicomSeriesInstances`: DICOMweb Instances -> ImageIds/ImageRefs
- `useCornerstoneStackViewport`: Cornerstone RenderingEngine + Viewport Setup
- `useCornerstoneStackSetup`: Stack setzen + Initial-VOI + Tool-Aktivierung
- `useCornerstoneViewerTools`: Tool-Selection + Window/Level Presets
- `useStackFrameNavigation`: Frame-Wechsel + Requested Frame Sync
- `useStackPrefetch`: Prefetch nahe Frames
- `useApplyViewportSyncState`: Externe Sync-State Anwendung
- `useViewerReset`: Reset-Logik fuer Viewport/Tool/WL
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
