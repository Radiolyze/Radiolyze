# Roadmap

## Phase 1: UI MVP (0-4 Wochen)

- 3-Spalten Layout finalisieren
- Cornerstone Viewer Integration (Stack, Tools, W/L)
- Findings/Impression Panels stabilisieren
- ASR Pipeline Anbindung (MedASR, Audio Upload)
- Basis QA Checks und Status Overlay

## Phase 2: Backend Orchestrator (4-8 Wochen)

- FastAPI Endpunkte (create/get/finalize)
- Orthanc DICOMweb Anbindung
- Inference Queue (MedGemma, Impression LLM)
- Audit Logging (Art. 12)

## Phase 3: Compliance Ready (8-12 Wochen)

- Human Oversight Dialog + Audit Trail
- EU AI Act Dokumentation (Annex IV)
- Drift Monitoring (Post-Market)
- Security Hardening (TLS, RBAC)

## Phase 4: Production (12-20 Wochen)

- DICOM SR Export
- Templates + Guidelines RAG
- Batch Reporting / Queue Optimierung
- Observability (Metrics + Tracing)

## Phase 5: Scale & Optimization (20+ Wochen)

- Performance Optimierung (Lazy Load, Web Worker)
- Multi-Site Deployment
- Advanced Viewer Tools (MPR, Annotations)
- Analytics Dashboard

## Risiken und Abhaengigkeiten

- GPU Verfuegbarkeit fuer Inference
- DICOM Vendor-Spezifika
- EU AI Act Interpretationen und Notified Bodies
