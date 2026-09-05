# Roadmap

> **Zuletzt gegen den Code abgeglichen:** 2026-09-02, `main` @ `0081341`.
> Haken im selben PR setzen, der den Punkt umsetzt. Beim letzten Abgleich war
> diese Datei um acht bereits erledigte Einträge veraltet — und veraltete
> Einträge sind nicht kostenlos: sie haben zwei doppelte PRs verursacht
> (#233/#236, #266/#267), jeweils von einem zweiten Durchlauf begonnen, der
> fertige Arbeit als offen vorfand. Die vollständige Aufnahme steht in
> `docs-internal/status-and-next-themes.md`.

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
- [x] Drift Monitoring (API-Report + Snapshot-Persistenz, APScheduler-Job via `DRIFT_SCHEDULE_HOURS`, Monitoring-UI)
- [~] Security Hardening (AuthN, TLS und Rate Limits erledigt; AuthZ/RBAC offen — `User.role` existiert, wird aber nicht durchgesetzt)

## Phase 5: Production (14-22 Wochen)

- [x] DICOM SR Export (JSON + Binary Export + UI, STOW-RS-Archivierung als `dicom_sr_orthanc_url` persistiert)
- [x] Templates + Guidelines RAG (pgvector-Cosine-Suche, Embedding-Worker, ILIKE-Fallback)
- [x] vLLM GPU Worker (Compose + API Integration, Multimodal)
- [x] DICOM -> Image Pipeline fuer Multimodal Inference (`retrieve_rendered_frame` + Redis-gecachtes `retrieve_and_cache_frame`)
- [x] Batch Reporting Dashboard (Multi-Select, Bulk Actions, Analytics + API Anbindung)
- [x] Report History / Audit Log UI
- [x] Observability (Metrics-Endpoint + Drift-Report + OpenTelemetry-Tracing, `backend/app/tracing.py`)

## Phase 5.5: MedGemma Capability Expansion (16-24 Wochen)

- [x] MedGemma Bounding-Box Lokalisierung Pipeline (Backend: Prompt, Parser, DB-Persistenz)
- [x] AI Findings Overlay (SVG-Overlay, Farbkodierung, Eye/EyeOff-Toggle, Hover-Details)
- [x] Index.tsx Verdrahtung: report.inferenceFindings als findings-Prop an DicomViewer durchreichen
- [x] On-Demand Frame-Lokalisierung: API-Endpunkt POST /api/v1/inference/localize (einzelner Frame, schnelle Antwort via Job-Polling)
- [x] "Frame analysieren"-Button in der DicomViewer-Toolbar (aktuellen Frame an Lokalisierungs-Endpoint senden)
- [x] 3D-Readiness: Slice-Order (IPP-z -> SliceLocation -> InstanceNumber), Spacing, VOI/WL-Persistenz
- [x] Longitudinal Context: Current/Prior Paare + Time-Delta (`ReportComparison`-Modell + API)
- [x] Strukturierte Outputs (JSON Schema via `guided_json`, strikte Validierung hinter `SCHEMA_STRICT`)
- [x] Evidence-Indices verpflichtend bei Bild-Inputs (`model_validator` in `ai_schemas.py`)
- [ ] Optional: WSI/Patch Manifest + Tile Inputs
- [ ] Data Capture Modus (Rendered PNG + Manifest)

## Phase 6: Scale & Optimization (22+ Wochen)

- [ ] Performance Optimierung (Web Worker, Streaming)
- [ ] Medusa/Multi-Token Decoding fuer niedrigere Latenz
- [ ] Multi-Site Deployment
- [x] Advanced Viewer Tools (MPR, VRT, Annotation Suite)
- [ ] Analytics Dashboard

## Phase 7: 3D-Tissue-Modelle (parallel zu Phase 5/6)

- [x] **M1**: Bone-HU End-to-End-Pipeline (Segmenter-Microservice, Backend-Orchestrator, vtk.js MeshViewer, GLB+VTP+NIfTI-Export, Audit-Events) — Details: `components/segmenter.md`
- [x] **M2**: TotalSegmentator Multi-Organ (~104 Klassen, GPU-Build, label-weises Lazy-Mesh-Loading, Label-Suche/Sort)
- [~] **M3**: Polish (Color-Editor, Loading-Skeletons, Cross-Section-Clip-Plane und ROCm-Variante erledigt; Mesh-Bundle-Budget offen)
- [x] **M4**: DICOM-SEG-Export via `highdicom` mit STOW-RS-Push an Orthanc (Push-Button im MeshViewer, Audit `segmentation_pushed_to_pacs`)

## Naechste Schritte (naechster Sprint)

Saemtliche Punkte der vorherigen Liste (MedGemma-Overlay, Annex IV,
Drift-Scheduling, Tracing, RAG, DICOM-Image-Pipeline, 3D-Readiness,
Longitudinal Context, strukturierte Outputs) sind umgesetzt. Uebrig bleibt
daraus nur RBAC, als Punkt 7 unten.

Die aktuellen Prioritaeten sind damit Wartung, nicht Features. Vollstaendige
Begruendung und Aufwaende: `docs-internal/status-and-next-themes.md`.

1. Issue-Tracker mit dem Code abgleichen — neun von elf offenen Issues sind umgesetzt.
2. mypy-Backlog abbauen (107 Fehler in 29 Dateien) und das Gate blockierend schalten.
3. Dependabot-Rueckstau abarbeiten (20 offene PRs; nur `eslint <10` ist bewusst gehalten).
4. i18n abschliessen (#117) und den Coverage-Boden von 11 % nachziehen.
5. Backend-Monolithen aufteilen (#293) — `inference_clients.py` (774), `api/training.py` (752) und `api/inference.py` (615) sind erledigt, die letzten beiden jetzt `app/services/training_export/` und `app/services/inference_queue/` hinter reinen Routen-Modulen; `tasks.py` (991) steht noch aus, hinter #296.
6. E2E-Abdeckung fuer die Viewer-Interaktion (#116) — blockiert durch die Entscheidung zu DICOM-Fixtures.
7. AuthZ/RBAC: `User.role` existiert am Modell, wird aber nirgends durchgesetzt.
8. Phase 6, nach einer eigenen Aufnahme — ihre Punkte sind gelistet, nicht analysiert.

## Risiken und Abhaengigkeiten

- GPU Verfuegbarkeit fuer Inference
- DICOM Vendor-Spezifika
- EU AI Act Interpretationen und Notified Bodies
