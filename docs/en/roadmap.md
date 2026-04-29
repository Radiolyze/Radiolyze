# Roadmap

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
- [~] Drift monitoring (API report + snapshot persistence, scheduling/UI open)
- [~] Security hardening (baseline documentation; AuthN/AuthZ, TLS, rate limits open)

## Phase 5: Production (14-22 Weeks)

- [~] DICOM SR export (JSON + binary export + UI, archiving/persistence open)
- [ ] Templates + Guidelines RAG
- [x] vLLM GPU worker (Compose + API integration, multimodal)
- [ ] DICOM -> image pipeline for multimodal inference (WADO-RS/JPEG)
- [x] Batch Reporting Dashboard (multi-select, bulk actions, analytics + API integration)
- [x] Report history / audit log UI
- [~] Observability (metrics endpoint + drift report, tracing open)

## Phase 5.5: MedGemma Capability Expansion (16-24 Weeks)

- [x] MedGemma bounding-box localization pipeline (backend: prompt, parser, DB persistence)
- [x] AI findings overlay (SVG overlay, color coding, Eye/EyeOff toggle, hover details)
- [x] Index.tsx wiring: pass report.inferenceFindings as findings prop to DicomViewer
- [x] On-demand frame localization: API endpoint POST /api/v1/inference/localize (single frame, fast response via job polling)
- [x] "Analyze frame" button in DicomViewer toolbar (send current frame to localization endpoint)
- [ ] 3D readiness: slice order, spacing, VOI/WL persistence
- [ ] Longitudinal context: current/prior pairs + time delta
- [ ] Structured outputs (JSON Schema + validation)
- [ ] Evidence indices mandatory for image inputs
- [ ] Optional: WSI/patch manifest + tile inputs
- [ ] Data capture mode (rendered PNG + manifest)

## Phase 6: Scale & Optimization (22+ Weeks)

- [ ] Performance optimization (web worker, streaming)
- [ ] Medusa/multi-token decoding for lower latency
- [ ] Multi-site deployment
- [ ] Advanced viewer tools (MPR, annotation suite)
- [ ] Analytics dashboard

## Phase 7: 3D Tissue Models (parallel to Phase 5/6)

- [x] **M1**: Bone-HU end-to-end pipeline (segmenter microservice, backend orchestrator, vtk.js MeshViewer, GLB+VTP+NIfTI export, audit events) — see `components/segmenter.md`
- [ ] **M2**: TotalSegmentator multi-organ (~104 classes, GPU build, lazy mesh loading, label search/sort)
- [ ] **M3**: Polish (color editor, loading skeletons, cross-section clip plane, ROCm variant, mesh bundle budget)
- [x] **M4**: DICOM SEG export via `pydicom-seg` with STOW-RS push to Orthanc (push button in MeshViewer, `segmentation_pushed_to_pacs` audit)

## Next Steps (Next Sprint)

### MedGemma Overlay (Proposals 3-5, immediately actionable)

1. Wire Index.tsx: pass `report.inferenceFindings` as `findings` prop to `<DicomViewer>` — makes the overlay functional.
2. On-demand frame localization: backend endpoint `POST /api/v1/inference/localize` for a single frame (job queue, fast polling).
3. "Analyze frame" button in DicomViewer toolbar: send current frame ImageRef to localization endpoint, display findings directly in the overlay.

### Medium-term

4. Complete Annex IV (risk analysis, data governance, model cards, KPI/drift).
5. Implement security hardening (JWT/OIDC, RBAC, TLS termination, rate limits).
6. Operationalize drift monitoring (scheduler, alerts UI, review process).
7. Observability/tracing (OpenTelemetry, dashboard, log correlation).
8. Design Templates/Guidelines RAG (vector store, retrieval API, UI hook).
9. DICOM -> image pipeline for multimodal (WADO-RS render/JPEG, caching/TTL).
10. 3D readiness: capture slice metadata + sampling strategies.
11. Longitudinal context: persist time delta + prior mapping.
12. Prepare structured JSON outputs + schema validation.

## Risks and Dependencies

- GPU availability for inference
- DICOM vendor-specific behavior
- EU AI Act interpretations and notified bodies
