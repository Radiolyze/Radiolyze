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
  - [ ] Risikoanalyse nach FMEA/ISO 14971
  - [ ] Daten-Governance-Dokumentation (Anonymisierung, Training)
  - [ ] Model Cards mit Trainingsdatenquellen und Evaluationsmetriken
  - [ ] KPI/Drift-Dashboard fuer Compliance-Nachweise
- [x] Drift Monitoring Scheduler (APScheduler, DRIFT_SCHEDULE_HOURS, compute_drift_snapshot extrahiert)
- [~] Security Hardening (Baseline Doku; AuthN/AuthZ, TLS, Rate Limits offen)
  - [ ] TLS-Terminierung in nginx.conf + docker-compose.yml (Let's Encrypt / Cert-Manager)
  - [ ] ENABLE_HSTS in Produktions-Compose aktivieren

## Phase 5: Production (14-22 Wochen)

- [~] DICOM SR Export (JSON + Binary Export + UI, Archivierung/Persistenz offen)
- [ ] Templates + Guidelines RAG
  - [ ] pgvector-Extension + embedding-Kolumne im Guideline-Modell
  - [ ] Embedding-Worker (Text -> Vektor -> DB bei Create/Update)
  - [ ] Semantischer Such-Endpunkt /api/v1/guidelines/semantic-search
  - [ ] Frontend: GuidelinesPanel auf semantische Suche umstellen
- [x] vLLM GPU Worker (Compose + API Integration, Multimodal)
- [ ] DICOM -> Image Pipeline fuer Multimodal Inference (WADO-RS/JPEG)
  - [ ] retrieve_rendered_frame() in dicom_client.py (WADO-RS /rendered Endpunkt)
  - [ ] Worker-Task nutzt retrieve_rendered_frame wenn keine image_urls vorhanden
  - [ ] Redis-Caching fuer retrievte Frames (TTL 5 min)
- [x] Batch Reporting Dashboard (Multi-Select, Bulk Actions, Analytics + API Anbindung)
- [x] Report History / Audit Log UI
- [~] Observability (Metrics-Endpoint + Drift-Report, Tracing offen)
  - [ ] OpenTelemetry SDK + FastAPI-Instrumentierung
  - [ ] Jaeger-Service in docker-compose.yml
  - [ ] Span-Instrumentierung in Inference-Endpunkt und Worker-Tasks

## Phase 5.5: MedGemma Capability Expansion (16-24 Wochen)

- [x] MedGemma Bounding-Box Lokalisierung Pipeline (Backend: Prompt, Parser, DB-Persistenz)
- [x] AI Findings Overlay (SVG-Overlay, Farbkodierung, Eye/EyeOff-Toggle, Hover-Details)
- [x] Index.tsx Verdrahtung: report.inferenceFindings als findings-Prop an DicomViewer durchreichen
- [x] On-Demand Frame-Lokalisierung: API-Endpunkt POST /api/v1/inference/localize (einzelner Frame, schnelle Antwort via Job-Polling)
- [x] "Frame analysieren"-Button in der DicomViewer-Toolbar (aktuellen Frame an Lokalisierungs-Endpoint senden)
- [ ] 3D-Readiness: Slice-Order, Spacing, VOI/WL Persistenz
  - [ ] Slice-Sortierung nach ImagePositionPatient[2] / SliceLocation (Fallback InstanceNumber)
  - [ ] VOI/WL-Persistenz in useUserPreferences (localStorage + API)
- [ ] Longitudinal Context: Current/Prior Paare + Time-Delta
  - [ ] DB-Modell ReportComparison (current_report_id, prior_study_id, time_delta_days)
  - [ ] API: POST /api/v1/reports/{id}/comparisons + GET
  - [ ] Frontend: Prior-Auswahl persistiert Comparison-Record
- [ ] Strukturierte Outputs (JSON Schema + Validation)
- [ ] Evidence-Indices verpflichtend bei Bild-Inputs
  - [ ] model_validator in ai_schemas.py: evidence_indices Pflicht wenn image_refs vorhanden
- [ ] Optional: WSI/Patch Manifest + Tile Inputs
- [ ] Data Capture Modus (Rendered PNG + Manifest)

## Phase 6: Scale & Optimization (22+ Wochen)

- [ ] Performance Optimierung (Web Worker, Streaming)
- [ ] Medusa/Multi-Token Decoding fuer niedrigere Latenz
- [ ] Multi-Site Deployment
- [ ] Advanced Viewer Tools (MPR, Annotation Suite)
- [ ] Analytics Dashboard

## Naechste Schritte (naechster Sprint)

### MedGemma Overlay (Proposals 3-5, sofort umsetzbar)

1. Index.tsx verdrahten: `report.inferenceFindings` als `findings`-Prop an `<DicomViewer>` weiterreichen — macht das Overlay funktional.
2. On-Demand Frame-Lokalisierung: Backend-Endpunkt `POST /api/v1/inference/localize` fuer einzelnen Frame (Job-Queue, schnelles Polling).
3. "Frame analysieren"-Button in der DicomViewer-Toolbar: aktuellen Frame-ImageRef an Lokalisierungs-Endpunkt senden, Findings direkt im Overlay anzeigen.

### Mittelfristig

4. Annex IV ausfuellen (Risikoanalyse, Data-Governance, Model Cards, KPI/Drift).
5. Security Hardening umsetzen (JWT/OIDC, RBAC, TLS-Termination, Rate Limits).
6. Drift Monitoring operationalisieren (Scheduler, Alerts-UI, Review-Prozess).
7. Observability/Tracing (OpenTelemetry, Dashboard, Log-Korrelation).
8. Templates/Guidelines RAG konzipieren (Vector Store, Retrieval API, UI Hook).
9. DICOM -> Image Pipeline fuer Multimodal (WADO-RS Render/JPEG, Caching/TTL).
10. 3D-Readiness: Slice-Metadaten + Sampling-Strategien erfassen.
11. Longitudinal Context: Time-Delta + Prior Mapping persistieren.
12. Strukturierte JSON-Outputs + Schema-Validierung vorbereiten.

## Risiken und Abhaengigkeiten

- GPU Verfuegbarkeit fuer Inference
- DICOM Vendor-Spezifika
- EU AI Act Interpretationen und Notified Bodies
