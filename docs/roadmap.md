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

## Phase 3.5: Maintenance & Refactoring

- [x] Viewer Modularisierung (Hooks, Config Separation)
- [x] DicomViewer in Subcomponents (Toolbar, Overlays, Empty-State)
- [x] ComparisonViewer in Subcomponents (Toolbar, Pane, Sync-Indicator)
- [x] Viewport Sync/Persistenz Hooks konsolidiert
- [x] Cornerstone Debug-Logging via Env Flag
- [x] Backend Router Split (Reports, Inference, Prompts, Audit, Monitoring, WS)
- [x] Backend Utils (Hashing/Inference/Metrics/Time) + get_db Dependency
- [x] Frontend ReportWorkspace Container + Inference/QA Helpers

## Phase 4: Compliance Ready (10-14 Wochen)

- [~] Human Oversight Dialog + Audit Trail (Dialog vorhanden; Pflichtfelder fuer Inference/Impression/QA/ASR, Report-Events noch nicht durchgaengig)
- [~] EU AI Act Dokumentation (Annex IV Entwurf vorhanden, offene TODOs)
- [~] Drift Monitoring (API-Report + Snapshot-Persistenz, Scheduling/UI offen)
- [~] Security Hardening (Baseline Doku; AuthN/AuthZ, TLS, Rate Limits offen)

## Phase 5: Production (14-22 Wochen)

- [~] DICOM SR Export (JSON + Binary Export + UI, Archivierung/Persistenz offen)
- [ ] Templates + Guidelines RAG
- [x] vLLM GPU Worker (Compose + API Integration, Multimodal)
- [ ] DICOM -> Image Pipeline fuer Multimodal Inference (WADO-RS/JPEG)
- [x] Batch Reporting Dashboard (Multi-Select, Bulk Actions, Analytics + API Anbindung)
- [x] Report History / Audit Log UI
- [~] Observability (Metrics-Endpoint + Drift-Report, Tracing offen)

## Phase 5.5: MedGemma Capability Expansion (16-24 Wochen)

- [ ] 3D-Readiness: Slice-Order, Spacing, VOI/WL Persistenz
- [ ] Longitudinal Context: Current/Prior Paare + Time-Delta
- [ ] Strukturierte Outputs (JSON Schema + Validation)
- [ ] Evidence-Indices verpflichtend bei Bild-Inputs
- [ ] Optional: WSI/Patch Manifest + Tile Inputs
- [ ] Data Capture Modus (Rendered PNG + Manifest)

## Phase 6: Scale & Optimization (22+ Wochen)

- [ ] Performance Optimierung (Web Worker, Streaming)
- [ ] Medusa/Multi-Token Decoding fuer niedrigere Latenz
- [ ] Multi-Site Deployment
- [ ] Advanced Viewer Tools (MPR, Annotation Suite)
- [ ] Analytics Dashboard

## Naechste Schritte (naechster Sprint)

1. Annex IV ausfuellen (Risikoanalyse, Data-Governance, Model Cards, KPI/Drift).
2. Security Hardening umsetzen (JWT/OIDC, RBAC, TLS-Termination, Rate Limits).
3. Drift Monitoring operationalisieren (Scheduler, Alerts-UI, Review-Prozess).
4. Observability/Tracing (OpenTelemetry, Dashboard, Log-Korrelation).
5. Templates/Guidelines RAG konzipieren (Vector Store, Retrieval API, UI Hook).
6. DICOM -> Image Pipeline fuer Multimodal (WADO-RS Render/JPEG, Caching/TTL).
7. 3D-Readiness: Slice-Metadaten + Sampling-Strategien erfassen.
8. Longitudinal Context: Time-Delta + Prior Mapping persistieren.
9. Strukturierte JSON-Outputs + Schema-Validierung vorbereiten.

## Risiken und Abhaengigkeiten

- GPU Verfuegbarkeit fuer Inference
- DICOM Vendor-Spezifika
- EU AI Act Interpretationen und Notified Bodies
