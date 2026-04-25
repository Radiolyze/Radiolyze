# MedGemma 1.5 Usage in the Project (Current State)

## Objective and Scope
- Focus: Using MedGemma 1.5 capabilities within the existing product.
- No fine-tuning: this covers only current runtime usage and data collection for future evaluation.

## Methods and Sources in the Repo
- Runtime inference: `backend/app/inference_clients.py`, `backend/app/api/inference.py`, `backend/app/tasks.py`
- Image sources and selection: `src/hooks/useDicomSeriesInstances.ts`, `src/hooks/reporting/inferenceHelpers.ts`, `src/hooks/useReport.ts`
- Deployment: `docker-compose.yml`
- Viewer and comparison: `docs/components/viewer.md`, `src/components/Viewer/*`, `src/hooks/usePriorStudies.ts`
- Annotations/data collection: `backend/app/api/annotations.py`, `backend/app/api/training.py`, `src/types/annotations.ts`
- Audit/compliance: `docs/compliance/audit-logging.md`, `backend/app/audit.py`

## Summary
The project currently uses MedGemma 1.5 primarily for multimodal image-text inference
(impression/summary) based on 2D rendered DICOM frames. Infrastructure for current/prior
images and evidence indices already exists. The UI can display 3D volumes (MPR/VRT),
but inference currently processes only a selected subset of individual frames.
WSI/pathology, true volumetric inputs, structured longitudinal measurements, and
EHR documents are not integrated. Data collection is solid for 2D annotations and
audit trails, but incomplete for 3D and longitudinal analyses.

## Capability Mapping: MedGemma 1.5 vs. Implementation

| Capability | Status | Implementation | Notes |
| --- | --- | --- | --- |
| Multimodal (text + images) | in use | vLLM chat completion with `image_url` content; prompts for summary/impression | `backend/app/inference_clients.py` |
| Multi-frame/series input | partial | Frame selection per series (sampling/limit) | `src/hooks/reporting/inferenceHelpers.ts` |
| Longitudinal (current + prior) | partial | Prior studies + `role=current|prior` in ImageRefs; comparison viewer | `src/hooks/usePriorStudies.ts`, `src/pages/ReportWorkspace.tsx` |
| 3D volume analysis | partial (UI only) | MPR/VRT viewer present, but inference uses 2D frames | `docs/components/viewer.md`, `src/hooks/useDicomSeriesInstances.ts` |
| Anatomical localization/detection | partial (data collection) | 2D bounding boxes + labels captured; not used in inference output | `backend/app/api/annotations.py`, `backend/app/api/training.py` |
| Evidence/provenance | in use | Evidence indices extracted from model response and referenced in UI | `backend/app/inference_clients.py`, `src/components/RightPanel/ImpressionPanel.tsx` |
| WSI/pathology | not used | No WSI pipeline, no tile processing | - |
| Clinical documents/EHR | not used | No EHR imports; only report text in the system | - |
| Speech (MedASR) | in use | ASR service via vLLM; UI captures dictation | `backend/app/inference_clients.py`, `src/hooks/useASR.ts` |

## Additional Detail: 3D Data and MedGemma Input Format

### Chat/Multimodal Format (Current State in the Project)
- vLLM uses an OpenAI-compatible chat format with multimodal `content`.
- The project sends `image_url` entries (WADO-RS URLs or base64 data URLs).
- No direct DICOM/NIfTI handoff; everything goes through rendered 2D images.
- References: `backend/app/inference_clients.py` (`_build_multimodal_content`, `_encode_image_path`).

### 3D Volumes (CT/MR) - MedGemma 1.5
- Native 3D support requires preprocessing into slice sequences.
- Typical steps: load (DICOM/NIfTI) -> normalize/resample -> slices -> 896x896 -> list of images.
- Number of slices is limited by the context budget; the selection strategy is critical.

### Current State and Implications
- The pipeline follows the slice approach (WADO-RS rendered frames), but:
  - Slice selection is heavily reduced (sampling/frame limits).
  - Preprocessing details (window/level, HU scaling, resampling) are not persisted.
  - vLLM context limit is currently set to `--max-model-len 4096`; `VLLM_MAX_TOKENS` defaults to 512.
- References: `docker-compose.yml`, `src/hooks/reporting/inferenceHelpers.ts`.

### Missing 3D Parameters in the Data Collection Setup
- SliceThickness, PixelSpacing, ImageOrientation, SpacingBetweenSlices.
- Slice ordering and selection strategy (e.g. uniform sampling vs. key slices).
- Rendering parameters (window/level preset, VOI).

## Current Data Collection (Without Fine-Tuning)

### What Is Already Captured
- DICOM frame references: study/series/instance/frame, WADO URL, optional StudyDate/Modality/Role.
- Reports: findings/impression, QA status, QA warnings.
- Inference metadata: model version, input hash, output summary, evidence indices.
- Annotations: 2D geometry (bounding box/handles), labels, category, severity, laterality, region.
- Audit events: event type, actor, timestamp, metadata, source.

### Where Data Is Stored/Exported
- DB tables: `reports`, `inference_jobs`, `annotations`, `audit_events`.
- Export: COCO/HuggingFace/MedGemma JSON (without images; images retrievable via WADO-RS).

## Gaps in Data Collection (from a MedGemma 1.5 Capabilities Perspective)
1. Volumetric context is missing from inference:
   - Only rendered 2D frames are sent; no volumetric structure (slice spacing, orientation, pixel spacing).
   - Frame sampling further reduces 3D context.
2. Longitudinal context is minimal:
   - Role=current/prior is present, but no time delta, no registered mapping, and no quantitative follow-up data.
3. Localization is not connected to inference:
   - Annotations exist, but inference does not produce bounding boxes/segmentations for UI evidence.
4. Pathology/WSI and other modalities:
   - No tile/WSI handling, no dermatology/ophthalmology inputs.
5. Text and structural labels:
   - Findings/impression are free text; no normalized ontologies (RadLex, SNOMED).
   - ASR transcripts are not persisted server-side (audit captures only hash/length).

## Recommended Data Collection (Without Fine-Tuning)

### 1) Volume and Series Metadata
- Extend `ImageRef` with SliceThickness, PixelSpacing, ImageOrientation, SeriesInstanceUID.
- Store slice order/spacing per series (to enable volume reconstruction).
- Persist the actually sent frames (IDs + order) in the inference job.

### 2) Longitudinal Context
- Persist `time_delta_days` between current/prior.
- Store the used prior series (series ID + date + modality).
- Optional: manual comparison note or simple measurements (e.g. lesion size).

### 3) Evidence and Localization
- Optionally extend evidence to include bounding boxes/segmentations (even if human-annotated only).
- Link evidence to annotations (same frame ID + ROI).

### 4) Text Labels and Structure
- Capture structured labels (e.g. "no finding" vs. "finding", organ/region, laterality).
- Store prompt versions and system prompt hash with inference results (for evaluation).

### 5) Image Data for Re-Use
- Optional "data capture" mode:
  - Store rendered PNGs (compact) or reference WADO-RS endpoints.
  - Maintain a data catalog (study/series/frame) for future evaluation.

## Prioritized Next Steps (Data Collection)
1. Extend ImageRef and series metadata (volumetric context).
2. Persist longitudinal metadata (time delta + prior mapping).
3. Version evidence indices and link them to annotations.
4. Expand export statistics (per modality, per series, per label).
5. Optional: data capture mode for stored renderings.

## Extended Plan: Comprehensive Use of MedGemma 1.5 Capabilities

### P0: 3D Readiness in the Inference Pipeline
- Capture volume slices with consistent ordering and spacing.
- Define and document sampling strategies per modality (CT/MR).
- Persist rendering parameters (VOI/WL preset).
- Review and adjust vLLM context budget if needed (max-model-len, max_tokens).

### P1: Longitudinal Context as a First-Class Input
- Store explicit current/prior pairs with time delta in the inference queue.
- Optional: simple comparison metrics (e.g. lesion size, ROI measurement).
- Standardize comparison prompts (change/trend formulations).

### P1: Structured Outputs and Validation
- Enforce JSON outputs with schema validation (summary/impression/findings).
- Make evidence indices mandatory when images are used.
- Store prompt version and prompt fingerprint in audit/inference records.

### P2: WSI and Patch Workflows (Optional, but Covering Model Capabilities)
- Define a tile/patch manifest (index, coordinates, magnification).
- Support batch inputs for WSI (pooled patches with role/region).
- Extend annotation export to WSI tiles.

### P2: Better Use of Knowledge and Text Understanding
- Feed report templates/guidelines as context into prompts.
- Offer structured extraction (e.g. JSON for findings) as a dedicated endpoint.

### P3: Evaluation and Reproducibility
- Define golden sets for CT/MR/longitudinal (without training).
- Implement a replay mechanism for inference with the same slice set.
- Produce quality reports (coverage, missing metadata, drift indicators).
