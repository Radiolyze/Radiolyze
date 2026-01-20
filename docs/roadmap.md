# Roadmap

## Phase 1: UI MVP (0-4 Wochen)

- [x] 3-Spalten Layout finalisieren
- [x] Cornerstone Viewer Integration (Stack, Tools, W/L Presets)
- [x] Findings/Impression Panels stabilisieren
- [x] ASR Pipeline Anbindung (Audio Upload + API Fallback)
- [x] Basis QA Checks und Status Overlay
- [x] Annotation Export (JSON)
- [~] Stack Prefetch/Lazy Load (aktuell im Viewer aktiv)

## Phase 2: Backend Orchestrator (4-8 Wochen)

- [ ] FastAPI Endpunkte (create/get/finalize)
- [~] Orthanc DICOMweb Anbindung (QIDO-RS Studien/Serien + WADO-RS Frames)
- [ ] Inference Queue (MedGemma, Impression LLM)
- [ ] Audit Logging (Art. 12)

## Phase 3: Compliance Ready (8-12 Wochen)

- [~] Human Oversight Dialog + Audit Trail (Dialog vorhanden, Audit Trail ausbauen)
- [ ] EU AI Act Dokumentation (Annex IV)
- [ ] Drift Monitoring (Post-Market)
- [ ] Security Hardening (TLS, RBAC)

## Phase 4: Production (12-20 Wochen)

- [ ] DICOM SR Export
- [ ] Templates + Guidelines RAG
- [ ] Batch Reporting / Queue Optimierung
- [ ] Observability (Metrics + Tracing)

## Phase 5: Scale & Optimization (20+ Wochen)

- [ ] Performance Optimierung (Lazy Load, Web Worker)
- [ ] Multi-Site Deployment
- [ ] Advanced Viewer Tools (MPR, Annotation Suite)
- [ ] Analytics Dashboard

## Risiken und Abhaengigkeiten

- GPU Verfuegbarkeit fuer Inference
- DICOM Vendor-Spezifika
- EU AI Act Interpretationen und Notified Bodies
