# Frontend Architektur

## Struktur

Die UI ist in drei Hauptbereiche gegliedert:

- **Left Sidebar**: Patient, Voruntersuchungen, Serien, Queue, WebSocket-Status
- **Viewer**: DICOM Anzeige, Tools, Seriennavigation, Vergleichsmodus
- **Right Panel**: Findings, Impression, QA, Templates, Guidelines

## UI Komponenten (Auszug)

- `MainLayout`: Layout-Rahmen (Header + 3 Spalten)
- `DicomViewer`: Cornerstone Stack-Viewer (Tools, W/L Presets, Prefetch, Viewport Sync)
- `ComparisonViewer`: Split-View für Prior Studies Vergleich
- `ProgressOverlay`: ASR/AI/QA Status
- `FindingsPanel`: ASR gesteuertes Dictation UI
- `ImpressionPanel`: KI-Entwurf + Freigabe + SR Export
- `TemplatesPanel`: Institutions-Templates
- `GuidelinesPanel`: Leitlinienhinweise

## State-Management

- UI State lokal in Komponenten
- Zentraler Report-Status via `useReport` Hook (Update/Finalize via API)
- ASR Status via `useASR` Hook (Audio Upload + optionaler Mock-Fallback)
- Tastatur-Shortcuts via `useKeyboardShortcuts`
- WebSocket Live-Updates via `useWebSocket` + `useReportStatusSync`
- Viewport-Synchronisierung via `onViewportChange` / `syncState` Props
- Viewer Lifecycle via Cornerstone Hooks (Stack Setup, Prefetch, Sync, Reset)
- Queue Sync via `useDicomWebQueue` (DICOMweb + Report get/create)
- Prior Studies via `usePriorStudies` (DICOMweb PatientID Filter)
- Notifications via `useNotifications` (Audit Log + WS Refresh)

## Hooks

| Hook                   | Zweck                                      |
| ---------------------- | ------------------------------------------ |
| `useWebSocket`         | WebSocket-Verbindung mit Auto-Reconnect    |
| `useReportStatusSync`  | Live-Status-Updates in UI-State mergen     |
| `useReport`            | Report CRUD + Status                       |
| `useASR`               | Audio-Aufnahme + Transkription             |
| `useKeyboardShortcuts` | Globale Shortcuts (Viewer, Navigation)     |
| `useUserPreferences`   | Persistierte User-Einstellungen            |
| `useDicomWebQueue`     | DICOMweb Studien + Report Sync             |
| `usePriorStudies`      | Voruntersuchungen via DICOMweb             |
| `useStudyLookup`       | Studien-Metadaten fuer UI-Enrichment       |
| `useNotifications`     | Audit Log Benachrichtigungen               |

## Viewer Hooks (Cornerstone)

- `useDicomSeriesInstances`: DICOMweb Instances -> ImageIds/ImageRefs
- `useCornerstoneStackViewport`: RenderingEngine + Viewport Setup
- `useCornerstoneStackSetup`: Stack setzen + VOI Presets anwenden
- `useCornerstoneViewerTools`: Tool-Selection (Zoom/Pan/WL/Messen)
- `useStackFrameNavigation`: Frame Navigation + Requested Frame
- `useStackPrefetch`: Prefetch um aktuellen Frame
- `useApplyViewportSyncState`: Externe Sync-States anwenden
- `useViewportSync`: Debounced Sync bei Vergleichsmodus
- `useViewerReset`: Reset von Tool, W/L, Zoom, Frame

Viewer Konfiguration:

- `src/config/viewer.ts` (Tools + Window/Level Presets)

## Pages

| Route      | Komponente | Beschreibung                        |
| ---------- | ---------- | ----------------------------------- |
| `/`        | Index      | Haupt-Workspace (Viewer + Panels)   |
| `/batch`   | Batch      | Batch-Dashboard mit Bulk-Actions    |
| `/history` | History    | Audit-Log und Report-Historie       |
| `/settings`| Settings   | Benutzereinstellungen               |

## Accessibility

- Fokusindikatoren (Tailwind tokens)
- Button Labels + ARIA in kritischen Controls
- Reduced Motion via CSS

## Technische Schulden (bekannt)

- KI/Impression Inferenz mit Backend-Anbindung (Mock-Fallback wenn Service deaktiviert)
- Queue Prioritaeten/Selektion noch clientseitig (kein Queue Endpoint)
- SR Export ist Draft (JSON/Binary), noch kein C-STORE in Orthanc
- Notification Read-State nur lokal (kein serverseitiger Status)
