# Model Card – MedGemma (via vLLM)

**Created:** 2026-04-25  
**Reference:** EU AI Act Annex IV § 6 / § 11

---

## 1. Model identification

| Field | Value |
|------|------|
| Model family | MedGemma (Google DeepMind) |
| Variants | `google/medgemma-4b-it`, `google/medgemma-27b-it` (configurable via `VLLM_MODEL`) |
| Modality | Multimodal: text + image (radiology JPEG/PNG) |
| Serving framework | vLLM (OpenAI-compatible chat completions endpoint) |
| Use mode | Radiology reporting assistant (impression, localization) |

---

## 2. Intended use

### 2.1 In-scope use

- Generate radiology report impressions from structured findings + DICOM-derived images.
- Localize suspicious regions (bounding boxes) for single frames.
- Assist with reporting — **not** a replacement for clinician judgement.

### 2.2 Out-of-scope use

- Autonomous clinical decisions without human approval.
- Use outside radiology imaging (histology, endoscopy, etc.).
- Primary diagnosis in emergencies without parallel clinical assessment.
- Paediatric or pregnancy-related reporting without dedicated validation.

---

## 3. Training data (upstream)

MedGemma is an upstream model released by Google DeepMind. Radiolyze performs
**no pretraining**. The notes below summarize publicly available documentation
(as of 2025).

| Category | Details |
|-----------|---------|
| Architecture | Gemma 2 (Transformer decoder) + SigLIP vision encoder |
| Base pretraining | Large-scale web data (Common Crawl, books, code) via Gemma 2 |
| Medical fine-tuning | Radiology reports (MIMIC-CXR), pathology slides, ophthalmology images, medical QA (MedQA, MedMCQA, PubMedQA) |
| License | Gemma Terms of Use + Health AI Developer Foundations Terms |
| Source | `https://ai.google.dev/gemma/docs/medgemma` |

> For regulatory assessment, obtain the current MedGemma technical report from
> the manufacturer and record it as part of your Annex IV documentation.

---

## 4. Evaluation metrics (upstream)

Based on public benchmark reporting (Google, 2025):

| Benchmark | Task | Metric | MedGemma-4B | MedGemma-27B |
|-----------|------|--------|-------------|--------------|
| CheXpert | Chest X-ray classification | AUC | ~0.85 | ~0.89 |
| MIMIC-CXR report generation | Radiology report generation | RadGraph F1 | ~0.42 | ~0.46 |
| VQA-RAD | Radiology VQA | Accuracy | ~0.68 | ~0.73 |
| MedQA (USMLE) | Medical QA | Accuracy | ~0.67 | ~0.74 |

> These metrics are indicative only. Local validation for the intended use and
> population is required (EU AI Act Art. 9).

---

## 5. Known limitations and biases

| Limitation | Description | Mitigation in Radiolyze |
|-----------|-------------|--------------------------|
| Language bias | Pretraining is largely English; German reporting may lose nuance | Prompts in EN; optional DE UI translation |
| Population bias | Training data primarily from US/western institutions | Local validation recommended |
| Modality bias | Often stronger on chest X-ray than rare modalities | Model version and confidence shown in UI |
| Hallucinations | Can generate findings not present in the image | Mandatory human oversight; QA checks |
| Image quality | Artefacts/noise reduces accuracy | Quality checks; clinician reviews overlays |

---

## 6. Inference configuration in Radiolyze

| Parameter | ENV var | Default |
|-----------|---------|---------|
| Model ID | `VLLM_MODEL` | `google/medgemma-4b-it` |
| Endpoint | `VLLM_BASE_URL` | `http://vllm:8000` |
| Temperature | `VLLM_TEMPERATURE` | 0.1 |
| Max tokens | `VLLM_MAX_TOKENS` | 512 |
| Guided JSON | via `guided_json` parameter | enabled for structured outputs |

---

## 7. Audit trail

Each inference call creates an `InferenceJob` entry that includes:
- `model_version` (from `VLLM_MODEL`)
- `input_hash` (SHA-256 over DICOM metadata + findings text)
- `queued_at`, `started_at`, `completed_at`
- `metadata_json` containing `image_refs` (Instance UIDs, frame indices)

---

## 8. Versioning and update process

1. Update by changing `VLLM_MODEL` and restarting the container.
2. Each model version results in a distinct audit trail.
3. After updates, monitor drift closely for ~2 weeks.
4. Major updates require internal validation before production rollout.

---

## 9. Contact and responsibility

- **Model manufacturer:** Google DeepMind (`google/medgemma`)
- **System operator / provider:** (TBD — Annex IV § 1)
- **Technical contact:** (TBD)

