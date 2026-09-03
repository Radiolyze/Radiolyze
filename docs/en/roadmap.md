# Roadmap

> **Last reconciled against the code:** 2026-09-02, `main` @ `0081341`.
> Tick the box in the same PR that implements the item. At the last audit this
> file had drifted by eight already-completed entries, and stale entries are
> not free: they cost two duplicate PRs (#233/#236, #266/#267), each started by
> a second pass that found finished work still listed as open. The full audit
> is in `docs-internal/status-and-next-themes.md`.

## Phase 1: UI MVP (0-4 Weeks)

- [x] Finalize 3-column layout
- [x] Cornerstone Viewer integration (Stack, Tools, W/L Presets)
- [x] Stabilize Findings/Impression panels
- [x] ASR pipeline connection (audio upload + API fallback)
- [x] Basic QA checks and status overlay
- [x] Annotation export (JSON)
- [x] Stack prefetch/lazy load

## Phase 2: Backend Orchestrator (4-8 Weeks)

- [x] FastAPI endpoints (create/get/update/list/finalize + QA/ASR/Impression/Audit)
- [x] Orthanc DICOMweb integration (QIDO-RS studies/series + WADO-RS frames, Basic Auth)
- [x] Docker Compose stack (Frontend + Backend + Postgres + Orthanc)
- [x] WebSocket live updates (report status, QA events)
- [x] Inference queue (RQ + Redis, mock inference)
- [x] Audit logging (API + worker events, pagination + UI integration)
- [x] Notifications (audit log + WS refresh)

## Phase 3: Comparison Mode & Priors (6-10 Weeks)

- [x] ComparisonViewer with split view
- [x] Prior studies selection (study + series)
- [x] Frame synchronization (proportional)
- [x] Swap views (toggle layout)
- [x] Viewport synchronization (zoom, pan, window/level)
- [x] Prior studies timeline in sidebar
- [x] Automatic matching suggestions
- [x] Prior studies fetch via DICOMweb (PatientID filter)

## Phase 3.5: Maintenance & Refactoring

- [x] Viewer modularization (hooks, config separation)
- [x] DicomViewer split into subcomponents (Toolbar, Overlays, Empty-State)
- [x] ComparisonViewer split into subcomponents (Toolbar, Pane, Sync-Indicator)
- [x] Viewport sync/persistence hooks consolidated
- [x] Cornerstone debug logging via env flag
- [x] Backend router split (Reports, Inference, Prompts, Audit, Monitoring, WS)
- [x] Backend utils (Hashing/Inference/Metrics/Time) + get_db dependency
- [x] Frontend ReportWorkspace container + Inference/QA helpers

## Phase 4: Compliance Ready (10-14 Weeks)

- [~] Human Oversight dialog + audit trail (dialog present; mandatory fields for Inference/Impression/QA/ASR, report events not yet end-to-end)
- [~] EU AI Act documentation (Annex IV draft present, open TODOs)
- [x] Drift monitoring (API report + snapshot persistence, APScheduler job via `DRIFT_SCHEDULE_HOURS`, Monitoring UI)
- [~] Security hardening (AuthN, TLS and rate limits done; AuthZ/RBAC open — `User.role` exists but is not enforced)

## Phase 5: Production (14-22 Weeks)

- [x] DICOM SR export (JSON + binary export + UI, STOW-RS archiving persisted as `dicom_sr_orthanc_url`)
- [x] Templates + Guidelines RAG (pgvector cosine search, embedding worker, ILIKE fallback)
- [x] vLLM GPU worker (Compose + API integration, multimodal)
- [x] DICOM -> image pipeline for multimodal inference (`retrieve_rendered_frame` + Redis-cached `retrieve_and_cache_frame`)
- [x] Batch Reporting Dashboard (multi-select, bulk actions, analytics + API integration)
- [x] Report history / audit log UI
- [x] Observability (metrics endpoint + drift report + OpenTelemetry tracing, `backend/app/tracing.py`)

## Phase 5.5: MedGemma Capability Expansion (16-24 Weeks)

- [x] MedGemma bounding-box localization pipeline (backend: prompt, parser, DB persistence)
- [x] AI findings overlay (SVG overlay, color coding, Eye/EyeOff toggle, hover details)
- [x] Index.tsx wiring: pass report.inferenceFindings as findings prop to DicomViewer
- [x] On-demand frame localization: API endpoint POST /api/v1/inference/localize (single frame, fast response via job polling)
- [x] "Analyze frame" button in DicomViewer toolbar (send current frame to localization endpoint)
- [x] 3D readiness: slice order (IPP-z -> SliceLocation -> InstanceNumber), spacing, VOI/WL persistence
- [x] Longitudinal context: current/prior pairs + time delta (`ReportComparison` model + API)
- [x] Structured outputs (JSON Schema via `guided_json`, strict validation behind `SCHEMA_STRICT`)
- [x] Evidence indices mandatory for image inputs (`model_validator` in `ai_schemas.py`)
- [ ] Optional: WSI/patch manifest + tile inputs
- [ ] Data capture mode (rendered PNG + manifest)

## Phase 6: Scale & Optimization (22+ Weeks)

- [ ] Performance optimization (web worker, streaming)
- [ ] Medusa/multi-token decoding for lower latency
- [ ] Multi-site deployment
- [x] Advanced viewer tools (MPR, VRT, annotation suite)
- [ ] Analytics dashboard

## Phase 7: 3D Tissue Models (parallel to Phase 5/6)

- [x] **M1**: Bone-HU end-to-end pipeline (segmenter microservice, backend orchestrator, vtk.js MeshViewer, GLB+VTP+NIfTI export, audit events) — see `components/segmenter.md`
- [x] **M2**: TotalSegmentator multi-organ (~104 classes, GPU build, per-label lazy mesh loading, label search/sort)
- [~] **M3**: Polish (color editor, loading skeletons, cross-section clip plane and ROCm variant done; mesh bundle budget open)
- [x] **M4**: DICOM SEG export via `highdicom` with STOW-RS push to Orthanc (push button in MeshViewer, `segmentation_pushed_to_pacs` audit)

## Next Steps (Next Sprint)

Every item of the previous list (MedGemma overlay, Annex IV, drift
scheduling, tracing, RAG, the DICOM image pipeline, 3D readiness, longitudinal
context, structured outputs) is implemented. Only RBAC survives from it, as
item 7 below.

The current priorities are therefore maintenance, not features. Full reasoning
and effort estimates: `docs-internal/status-and-next-themes.md`.

1. Reconcile the issue tracker with the code — nine of eleven open issues are implemented.
2. Clear the mypy backlog (107 errors across 29 files) and make the gate blocking.
3. Work off the Dependabot queue (20 open PRs; only `eslint <10` is held deliberately).
4. Finish i18n (#117) and pull the frontend coverage ratchet past its 11% floor.
5. Split the backend monoliths (`tasks.py` 975 lines, `api/training.py` 752, `api/inference.py` 615); `inference_clients.py` is done under #293.
6. E2E coverage for viewer interaction (#116) — blocked on a decision about seeded DICOM fixtures.
7. AuthZ/RBAC: `User.role` exists on the model but nothing enforces it.
8. Phase 6, after an audit of its own — its items are listed, not analysed.

## Risks and Dependencies

- GPU availability for inference
- DICOM vendor-specific behavior
- EU AI Act interpretations and notified bodies
