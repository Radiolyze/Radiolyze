# Frontend Architektur

## Struktur

Die UI ist in drei Hauptbereiche gegliedert:

- **Left Sidebar**: Patient, Serien, Queue
- **Viewer**: DICOM Anzeige, Tools, Seriennavigation
- **Right Panel**: Findings, Impression, QA, Templates, Guidelines

## UI Komponenten (Auszug)

- `MainLayout`: Layout-Rahmen (Header + 3 Spalten)
- `DicomViewer`: Cornerstone Stack-Viewer (Tools, W/L Presets, Prefetch)
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

## Accessibility

- Fokusindikatoren (Tailwind tokens)
- Button Labels + ARIA in kritischen Controls
- Reduced Motion via CSS

## Technische Schulden (bekannt)

- KI/Impression APIs sind Mock
- Kein echter WebSocket-Stream
- Queue/Report State ohne Orchestrator-Endpunkte
