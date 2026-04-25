# Frontend Architecture

## Structure

The UI is divided into three main areas:

- **Left Sidebar**: Patient info, prior studies, series, queue, WebSocket status
- **Viewer**: DICOM display, tools, series navigation, comparison mode
- **Right Panel**: Findings, impression, QA, templates, guidelines

## UI Components (excerpt)

- `MainLayout`: Layout shell (header + 3 columns)
- `DicomViewer`: Cornerstone stack viewer (tools, W/L presets, prefetch, viewport sync)
- `ComparisonViewer`: Split view for comparing prior studies
- `ProgressOverlay`: ASR/AI/QA status display
- `FindingsPanel`: ASR-driven dictation UI
- `ImpressionPanel`: AI draft + sign-off + SR export
- `TemplatesPanel`: Institutional report templates
- `GuidelinesPanel`: Clinical guideline hints

## State Management

- UI state is local to components
- Central report state via `useReport` hook (update/finalize via API)
- ASR state via `useASR` hook (audio upload + optional mock fallback)
- Keyboard shortcuts via `useKeyboardShortcuts`
- WebSocket live updates via `useWebSocket` + `useReportStatusSync`
- Viewport synchronization via `onViewportChange` / `syncState` props
- Viewer lifecycle via Cornerstone hooks (stack setup, prefetch, sync, reset)
- Queue sync via `useDicomWebQueue` (DICOMweb + report get/create)
- Prior studies via `usePriorStudies` (DICOMweb PatientID filter)
- Notifications via `useNotifications` (audit log + WS refresh)

## Hooks

| Hook                   | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `useWebSocket`         | WebSocket connection with auto-reconnect         |
| `useReportStatusSync`  | Merge live status updates into UI state          |
| `useReport`            | Report CRUD + status                             |
| `useASR`               | Audio recording + transcription                  |
| `useKeyboardShortcuts` | Global shortcuts (viewer, navigation)            |
| `useUserPreferences`   | Persisted user settings                          |
| `useDicomWebQueue`     | DICOMweb studies + report sync                   |
| `usePriorStudies`      | Prior studies via DICOMweb                       |
| `useStudyLookup`       | Study metadata for UI enrichment                 |
| `useNotifications`     | Audit log notifications                          |

## Viewer Hooks (Cornerstone)

- `useDicomSeriesInstances`: DICOMweb instances -> ImageIds/ImageRefs
- `useCornerstoneStackViewport`: RenderingEngine + viewport setup
- `useCornerstoneStackSetup`: Set stack + apply VOI presets
- `useCornerstoneViewerTools`: Tool selection (zoom/pan/WL/measurement)
- `useStackFrameNavigation`: Frame navigation + requested frame
- `useStackPrefetch`: Prefetch around the current frame
- `useApplyViewportSyncState`: Apply external sync states
- `useViewportSync`: Debounced sync in comparison mode
- `useViewerReset`: Reset tool, W/L, zoom, and frame

Viewer configuration:

- `src/config/viewer.ts` (tools + window/level presets)

## Pages

| Route      | Component | Description                          |
| ---------- | --------- | ------------------------------------ |
| `/`        | Index     | Main workspace (viewer + panels)     |
| `/batch`   | Batch     | Batch dashboard with bulk actions    |
| `/history` | History   | Audit log and report history         |
| `/settings`| Settings  | User preferences                     |

## Accessibility

- Focus indicators (Tailwind tokens)
- Button labels + ARIA on critical controls
- Reduced motion via CSS

## Known Technical Debt

- AI/impression inference backend integration (mock fallback when service is disabled)
- Queue priorities/selection still handled client-side (no queue endpoint)
- SR export is a draft (JSON/binary); no C-STORE to Orthanc yet
- Notification read state is local only (no server-side status)
