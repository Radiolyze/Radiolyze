# Roadmap

## Phase 1: UI MVP (0-4 Wochen)

- [x] 3-Spalten Layout finalisieren
- [x] Cornerstone Viewer Integration (Stack, Tools, W/L Presets)
- [x] Findings/Impression Panels stabilisieren
- [x] ASR Pipeline Anbindung (Audio Upload + API Fallback)
- [x] Basis QA Checks und Status Overlay
- [x] Annotation Export (JSON)
- [x] Stack Prefetch/Lazy Load

## Phase 2: Backend Orchestrator (4-8 Wochen)

- [x] FastAPI Endpunkte (create/get/update/list/finalize + QA/ASR/Impression/Audit)
- [x] Orthanc DICOMweb Anbindung (QIDO-RS Studien/Serien + WADO-RS Frames, Basic Auth)
- [x] Docker Compose Stack (Frontend + Backend + Postgres + Orthanc)
- [x] WebSocket Live-Updates (Report-Status, QA-Events)
- [x] Inference Queue (RQ + Redis, Mock Inferenz)
- [x] Audit Logging (API + Worker Events, Pagination + UI Integration)
- [x] Notifications (Audit Log + WS Refresh)

## Phase 3: Vergleichsmodus & Priors (6-10 Wochen)

- [x] ComparisonViewer mit Split-View
- [x] Prior Studies Auswahl (Studie + Serie)
- [x] Frame-Synchronisierung (proportional)
- [x] Swap Views (Layout tauschen)
- [x] Viewport-Synchronisierung (Zoom, Pan, Window/Level)
- [x] Prior Studies Timeline in Sidebar
- [x] Automatische Matching-Vorschläge
- [x] Prior Studies Fetch via DICOMweb (PatientID Filter)

## Phase 4: Compliance Ready (10-14 Wochen)

- [~] Human Oversight Dialog + Audit Trail (Dialog vorhanden, Audit Trail erweitert)
- [~] EU AI Act Dokumentation (Annex IV Template, Inhalte offen)
- [ ] Drift Monitoring (Post-Market)
- [~] Security Hardening (Baseline Doku, TLS/RBAC Umsetzung offen)

## Phase 5: Production (14-22 Wochen)

- [~] DICOM SR Export (JSON + Binary Export, Archivierung offen)
- [ ] Templates + Guidelines RAG
- [~] vLLM GPU Worker (Compose + API Integration, Multimodal)
- [ ] DICOM -> Image Pipeline fuer Multimodal Inference (WADO-RS/JPEG)
- [x] Batch Reporting Dashboard (Multi-Select, Bulk Actions, Analytics + API Anbindung)
- [x] Report History / Audit Log UI
- [ ] Observability (Metrics + Tracing)

## Phase 6: Scale & Optimization (22+ Wochen)

- [ ] Performance Optimierung (Web Worker, Streaming)
- [ ] Medusa/Multi-Token Decoding fuer niedrigere Latenz
- [ ] Multi-Site Deployment
- [ ] Advanced Viewer Tools (MPR, Annotation Suite)
- [ ] Analytics Dashboard

## Risiken und Abhaengigkeiten

- GPU Verfuegbarkeit fuer Inference
- DICOM Vendor-Spezifika
- EU AI Act Interpretationen und Notified Bodies
