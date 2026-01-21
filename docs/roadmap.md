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

- [x] FastAPI Endpunkte (create/get/finalize + QA/ASR/Impression/Audit)
- [x] Orthanc DICOMweb Anbindung (QIDO-RS Studien/Serien + WADO-RS Frames, Basic Auth)
- [x] Docker Compose Stack (Frontend + Backend + Postgres + Orthanc)
- [x] WebSocket Live-Updates (Report-Status, QA-Events)
- [ ] Inference Queue (MedGemma, Impression LLM)
- [~] Audit Logging (Art. 12 Baseline: API + DB, Felder/Hashing offen)

## Phase 3: Vergleichsmodus & Priors (6-10 Wochen)

- [x] ComparisonViewer mit Split-View
- [x] Prior Studies Auswahl (Studie + Serie)
- [x] Frame-Synchronisierung (proportional)
- [x] Swap Views (Layout tauschen)
- [x] Viewport-Synchronisierung (Zoom, Pan, Window/Level)
- [ ] Prior Studies Timeline in Sidebar
- [ ] Automatische Matching-Vorschläge

## Phase 4: Compliance Ready (10-14 Wochen)

- [~] Human Oversight Dialog + Audit Trail (Dialog vorhanden, Audit Trail ausbauen)
- [ ] EU AI Act Dokumentation (Annex IV)
- [ ] Drift Monitoring (Post-Market)
- [ ] Security Hardening (TLS, RBAC)

## Phase 5: Production (14-22 Wochen)

- [ ] DICOM SR Export
- [ ] Templates + Guidelines RAG
- [x] Batch Reporting Dashboard (Multi-Select, Bulk Actions, Analytics)
- [x] Report History / Audit Log UI
- [ ] Observability (Metrics + Tracing)

## Phase 6: Scale & Optimization (22+ Wochen)

- [ ] Performance Optimierung (Web Worker, Streaming)
- [ ] Multi-Site Deployment
- [ ] Advanced Viewer Tools (MPR, Annotation Suite)
- [ ] Analytics Dashboard

## Risiken und Abhaengigkeiten

- GPU Verfuegbarkeit fuer Inference
- DICOM Vendor-Spezifika
- EU AI Act Interpretationen und Notified Bodies
