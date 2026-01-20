# Frontend Architektur

## Struktur

Die UI ist in drei Hauptbereiche gegliedert:

- **Left Sidebar**: Patient, Serien, Queue
- **Viewer**: DICOM Anzeige, Tools, Seriennavigation
- **Right Panel**: Findings, Impression, QA, Templates, Guidelines

## UI Komponenten (Auszug)

- `MainLayout`: Layout-Rahmen (Header + 3 Spalten)
- `DicomViewer`: Viewer UI (Mock, vorbereitet fuer Cornerstone)
- `ProgressOverlay`: ASR/AI/QA Status
- `FindingsPanel`: ASR gesteuertes Dictation UI
- `ImpressionPanel`: KI-Entwurf + Freigabe
- `TemplatesPanel`: Institutions-Templates
- `GuidelinesPanel`: Leitlinienhinweise

## State-Management

- UI State lokal in Komponenten
- Zentraler Report-Status via `useReport` Hook (Mock)
- ASR Status via `useASR` Hook (Mock)
- Tastatur-Shortcuts via `useKeyboardShortcuts`

## Accessibility

- Fokusindikatoren (Tailwind tokens)
- Button Labels + ARIA in kritischen Controls
- Reduced Motion via CSS

## Technische Schulden (bekannt)

- Cornerstone3D ist nicht integriert
- ASR/AI/QA APIs sind Mock
- Kein echter WebSocket-Stream
