# Roadmap Validation: Current State vs. Code

**Date:** 2025-02-26  
**Branch:** cursor/roadmap-code-abgleich-e514

## Summary

The roadmap (`docs/roadmap.md`) describes the next steps in the sprint "MedGemma Overlay (Proposals 3-5)". Validation against the current codebase shows: **all three immediately actionable items are still open**.

---

## Next Steps (Sprint) – Validation

### 1. Index.tsx Wiring: `report.inferenceFindings` → DicomViewer

**Roadmap:** Pass `report.inferenceFindings` as `findings` prop to `<DicomViewer>`.

**Status:** ❌ **Not implemented**

**Finding:**
- `Index.tsx` only renders `<ReportWorkspace />` — the actual wiring resides in `ReportWorkspace.tsx`.
- `ReportWorkspace` uses `useReport()` and receives `report` with `inferenceFindings` (set during `generateImpression`/`analyzeImages`).
- `ComparisonViewer` receives **no** `findings` or `inferenceFindings` prop.
- `ComparisonSingleView` and `ComparisonPane` call `<DicomViewer>` — **without** a `findings` prop.
- `DicomViewer` already has the prop `findings?: FindingBox[]` and renders `<AIFindingsOverlay findings={findings} />` — the infrastructure is in place; the data simply does not reach it.

**Current data flow:**
```
ReportWorkspace (report.inferenceFindings present)
  → ComparisonViewer (findings not passed)
    → ComparisonSingleView / ComparisonPane
      → DicomViewer (findings = [] default)
```

**Required change:**
- Thread `findings` through the chain: ReportWorkspace → ComparisonViewer → ComparisonSingleView/ComparisonPane → DicomViewer.
- Pass `report?.inferenceFindings ?? []` as a prop.

---

### 2. On-Demand Frame Localization: `POST /api/v1/inference/localize`

**Roadmap:** Backend endpoint for a single frame (job queue, fast polling).

**Status:** ✅ **Implemented** (Proposal 2)

**Finding:**
- `POST /api/v1/inference/localize` with `LocalizeRequest` (report_id, study_id, image_ref)
- `run_localize_job` task in tasks.py, `generate_localize_findings` in inference_clients
- Frontend: `inferenceClient.queueLocalize(payload)` in inferenceClient.ts
- Polling via existing `GET /api/v1/inference/status/{job_id}` (result.findings)

---

### 3. "Analyze Frame" Button in DicomViewer Toolbar

**Roadmap:** Send current frame to localization endpoint, display findings in the overlay.

**Status:** ✅ **Implemented** (Proposal 3)

**Finding:**
- "Analyze frame" button in DicomViewerToolbar (scan icon)
- Callback onAnalyzeFrame threaded through ReportWorkspace → ComparisonViewer → ComparisonSingleView/ComparisonPane → DicomViewer → Toolbar
- handleAnalyzeFrame: queueLocalize, pollInferenceResult, extractInferenceFindings, merge into report.inferenceFindings
- i18n: tools.analyzeFrame, tools.analyzeFrameHint

---

## Phase 4 & 5 – Brief Overview

| Item | Roadmap | Code Status |
|------|---------|-------------|
| Human Oversight Dialog | [~] | Dialog present; mandatory fields/report events not end-to-end |
| EU AI Act Annex IV | [~] | Draft present, TODOs open |
| Drift Monitoring | [~] | API report + snapshot, scheduling/UI open |
| Security Hardening | [~] | Baseline documentation; AuthN/AuthZ/TLS/rate limits open |
| DICOM SR Export | [~] | JSON + binary + UI, archiving open |
| Templates + Guidelines RAG | [ ] | Not started |
| DICOM → Image Pipeline | [ ] | Not started |
| Observability | [~] | Metrics + drift report, tracing open |

---

## Phase 5.5 MedGemma – Further Open Items

| Item | Status |
|------|--------|
| Index.tsx wiring | ❌ Open |
| On-demand frame localization API | ❌ Open |
| "Analyze frame" button | ❌ Open |
| 3D readiness | ❌ Open |
| Longitudinal context | ❌ Open |
| Structured outputs (JSON Schema) | ❌ Open |
| Evidence indices mandatory | ❌ Open |
| WSI/patch manifest | ❌ Open |
| Data capture mode | ❌ Open |

---

## Recommended Implementation Order

1. **Proposal 1 (Wiring)** — Small change, immediately visible benefit: overlay displays existing `inferenceFindings`.
2. **Proposal 2 (Backend localize)** — Prerequisite for Proposal 3.
3. **Proposal 3 (Analyze frame button)** — Builds on Proposals 1+2, completes the feature chain.

---

## Dependencies

- **Proposal 1** is independent and can be implemented immediately.
- **Proposal 2** may require adjustments in `inference_clients.py` and `tasks.py` for a separate localization prompt/task.
- **Proposal 3** depends on Proposal 2 (or a mock for testing).
