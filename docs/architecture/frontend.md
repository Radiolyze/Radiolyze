# Frontend Architektur

## Struktur

Die UI ist in drei Hauptbereiche gegliedert:

- **Left Sidebar**: Patient, Serien, Queue, WebSocket-Status
- **Viewer**: DICOM Anzeige, Tools, Seriennavigation, Vergleichsmodus
- **Right Panel**: Findings, Impression, QA, Templates, Guidelines

## UI Komponenten (Auszug)

- `MainLayout`: Layout-Rahmen (Header + 3 Spalten)
- `DicomViewer`: Cornerstone Stack-Viewer (Tools, W/L Presets, Prefetch, Viewport Sync)
- `ComparisonViewer`: Split-View für Prior Studies Vergleich
- `ProgressOverlay`: ASR/AI/QA Status
- `FindingsPanel`: ASR gesteuertes Dictation UI
- `ImpressionPanel`: KI-Entwurf + Freigabe
- `TemplatesPanel`: Institutions-Templates
- `GuidelinesPanel`: Leitlinienhinweise

## State-Management

- UI State lokal in Komponenten
- Zentraler Report-Status via `useReport` Hook (QA via API, Findings/Impression lokal)
- ASR Status via `useASR` Hook (Audio Upload + API Fallback)
- Tastatur-Shortcuts via `useKeyboardShortcuts`
- WebSocket Live-Updates via `useWebSocket` + `useReportStatusSync`
- Viewport-Synchronisierung via `onViewportChange` / `syncState` Props

## Hooks

| Hook                   | Zweck                                      |
| ---------------------- | ------------------------------------------ |
| `useWebSocket`         | WebSocket-Verbindung mit Auto-Reconnect    |
| `useReportStatusSync`  | Live-Status-Updates in UI-State mergen     |
| `useReport`            | Report CRUD + Status                       |
| `useASR`               | Audio-Aufnahme + Transkription             |
| `useKeyboardShortcuts` | Globale Shortcuts (Viewer, Navigation)     |
| `useUserPreferences`   | Persistierte User-Einstellungen            |
| `useDicomWebQueue`     | DICOMweb Studien-Loading                   |

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

- KI/Impression Inferenz weiterhin Mock (Queue vorhanden)
- Queue/Report State ohne vollstaendige Orchestrator-Sync
- Prior Studies Timeline noch nicht in Sidebar integriert
