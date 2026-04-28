# MedGemma — Model Deep Dive

Detailed documentation of the MedGemma AI model used in Radiolyze: architecture, training data, benchmarks, inference configuration, and audit trail integration.

---

## Model Overview

| Field | Value |
|---|---|
| Model family | MedGemma (Google DeepMind) |
| Default variant | `google/medgemma-4b-it` |
| Alternative | `google/medgemma-27b-it` (configurable) |
| Modality | Multimodal: text + medical images (JPEG/PNG) |
| Serving framework | vLLM (OpenAI-compatible chat completions) |
| Role in Radiolyze | Radiology reporting assistant — impression generation, image analysis |

MedGemma is a **general-purpose medical multimodal model** released by Google DeepMind. It is not a radiology-specific model — it covers radiology, pathology, ophthalmology, and medical question answering. Radiolyze uses it specifically for chest X-ray and CT impression generation via a radiology-focused prompt.

---

## Architecture

| Component | Technology |
|---|---|
| Language backbone | Gemma 2 (Transformer decoder, 4B or 27B parameters) |
| Vision encoder | SigLIP (vision-language contrastive encoder) |
| Input | Image (up to 896×896 px) + text prompt |
| Output | Text (structured JSON or free text) |
| Context window | 8192 tokens (vLLM default; configurable via `--max-model-len`) |

**Image processing path in Radiolyze:**

1. DICOM frames rendered to JPEG via Orthanc WADO-RS endpoint
2. Frames base64-encoded and included in the vLLM chat completion request as `image_url` content
3. Model processes image + structured findings text prompt
4. Output: JSON with `impression`, `key_findings`, `evidence_indices`
5. Evidence indices map back to specific DICOM frames in the viewer

Up to 16 frames from the current study and 8 from prior studies are sent per inference call (configurable via `VITE_INFERENCE_MAX_FRAMES_CURRENT` and `VITE_INFERENCE_MAX_FRAMES_PRIOR`).

---

## Training Data

MedGemma is a pre-trained model from Google DeepMind. Radiolyze does **not** perform any fine-tuning or pretraining. The following information is based on publicly available model documentation.

| Dataset | Type | Notes |
|---|---|---|
| Gemma 2 base | Web text, books, code | General language understanding |
| MIMIC-CXR | Chest X-ray reports + images | Primary radiology training signal |
| Pathology slides | Whole-slide images | Digital pathology capability |
| Ophthalmology images | Fundus photography | Eye imaging capability |
| MedQA | Medical licensing exam QA | Clinical reasoning |
| MedMCQA | Medical multiple choice QA | Clinical knowledge |
| PubMedQA | Biomedical research QA | Scientific literature understanding |

For complete training data details, refer to the [Google MedGemma Technical Report](https://ai.google.dev/gemma/docs/medgemma) (external).

!!! note "Regulatory note"
    For EU AI Act Art. 11 technical documentation, request the current MedGemma Technical Report from Google DeepMind. This provides authoritative upstream training data provenance for your Annex IV documentation.

---

## Benchmark Performance

Published benchmark results from the MedGemma Technical Report (Google, 2025). These are upstream evaluations on English-language datasets. Local validation on your specific deployment is required separately (see [Validation Guide](validation.md)).

| Benchmark | Task | Metric | MedGemma-4B | MedGemma-27B |
|---|---|---|---|---|
| CheXpert | Chest X-ray classification (14 conditions) | AUC | ~0.85 | ~0.89 |
| MIMIC-CXR Report Generation | Radiology report generation | RadGraph F1 | ~0.42 | ~0.46 |
| VQA-RAD | Radiology visual question answering | Accuracy | ~0.68 | ~0.73 |
| MedQA (USMLE) | Medical licensing exam | Accuracy | ~0.67 | ~0.74 |

**Interpreting these numbers:**

- **CheXpert AUC ~0.85** means the model correctly discriminates between positive and negative cases 85% of the time on this benchmark dataset — comparable to strong resident performance on standard CXR findings.
- **RadGraph F1 ~0.42** measures how well the generated report matches the reference report's entity-relation graph — this is a strict structural metric; clinical impression accuracy is typically higher.
- **VQA-RAD ~0.68** covers diverse image types; radiology-specific questions score higher than general medical VQA.

These metrics are **not a substitute for site-specific validation.** Performance on your patient population, scanner types, and clinical workflow may differ.

---

## Known Limitations and Biases

| Limitation | Description | Mitigation in Radiolyze |
|---|---|---|
| Language bias | Pre-trained primarily on English; German findings processed correctly but subtle nuances may vary | Prompts sent in English; German translation handled in frontend |
| Population bias | Training data primarily from US/Western clinical centres | Local validation recommended before clinical deployment |
| Modality bias | Strongest on chest X-ray; weaker on rare modalities (PET, nuclear medicine) | Model name and version displayed in UI; radiologist reviews all outputs |
| Hallucinations | Like all LLMs, MedGemma can generate findings not present in the image | Human oversight mandatory; QA checks; approval dialog |
| Image quality sensitivity | Poor DICOM quality (motion artefacts, noise) reduces accuracy | Image quality QA checks; radiologist reviews viewer overlay |
| 2D frame limitation | Inference uses 2D frames, not volumetric 3D analysis | Frame count configurable; radiologist reviews full series in viewer |
| No EHR context | Model has no access to patient history, medications, or lab results | Radiologist integrates clinical context during review |

---

## Inference Configuration

These environment variables control MedGemma inference behaviour. Set them in your `.env` file.

| Parameter | Environment Variable | Default | Notes |
|---|---|---|---|
| Model ID | `VLLM_MODEL` | `google/medgemma-4b-it` | Change to `medgemma-27b-it` for higher quality (requires ≥40GB VRAM) |
| vLLM endpoint | `VLLM_BASE_URL` | `http://vllm:8000` | Internal Docker service URL |
| Temperature | `VLLM_TEMPERATURE` | `0.1` | Low temperature = more deterministic; increase for more varied outputs |
| Max tokens | `VLLM_MAX_TOKENS` | `512` | Maximum impression length; increase for complex studies |
| Max current frames | `VITE_INFERENCE_MAX_FRAMES_CURRENT` | `16` | Frames from current study sent to model |
| Max prior frames | `VITE_INFERENCE_MAX_FRAMES_PRIOR` | `8` | Frames from prior study for comparison |

**Context budget guidance:**

```
vLLM context = prompt tokens + image tokens + output tokens
Each 896x896 image ≈ 256 tokens (SigLIP encoding)
16 frames × 256 ≈ 4096 image tokens
+ 512 prompt tokens + 512 output tokens = ~5120 total
→ Requires --max-model-len ≥ 6144 (default 4096 may truncate)
```

If you send large studies, increase `--max-model-len` in `docker/compose/gpu.yml`.

---

## Structured Output

Radiolyze uses vLLM's `guided_json` parameter to enforce structured JSON output from MedGemma:

```json
{
  "impression": "No acute cardiopulmonary findings. Heart size normal.",
  "key_findings": [
    {
      "finding": "Clear lung fields bilaterally",
      "region": "lungs",
      "laterality": "bilateral"
    }
  ],
  "evidence_indices": [2, 5, 7]
}
```

- `impression`: Free-text impression for the report
- `key_findings`: Structured list of findings for the QA engine
- `evidence_indices`: Frame indices (0-based) that the model's output references — these light up in the viewer

---

## Audit Trail Integration

Every inference call produces an `InferenceJob` audit record:

```json
{
  "event_type": "inference_completed",
  "actor_id": "system",
  "study_id": "st-123",
  "report_id": "r-123",
  "metadata": {
    "model_version": "google/medgemma-4b-it",
    "input_hash": "a3f8b2c1d4e5f6a7",
    "queued_at": "2026-04-28T10:00:00Z",
    "started_at": "2026-04-28T10:00:03Z",
    "completed_at": "2026-04-28T10:00:07Z",
    "image_refs": ["1.2.840.10008.5.1.4.1.1.2.1", "1.2.840.10008.5.1.4.1.1.2.2"],
    "source": "worker"
  }
}
```

The `input_hash` is a SHA-256 hash of the DICOM metadata + findings text — no PHI is stored in the audit record.

---

## Switching Model Variants

To switch between MedGemma-4B and MedGemma-27B:

```bash
# In .env
VLLM_MODEL=google/medgemma-27b-it

# Restart vLLM service
docker compose restart vllm

# Monitor VRAM usage
watch -n 2 nvidia-smi
```

MedGemma-27B requires a GPU with ≥40GB VRAM (e.g. A100 80GB). For multi-GPU, set `--tensor-parallel-size 2` in `docker/compose/gpu.yml`.

For a full guide to switching AI backends, see [Model Switching](model-switching.md).

---

## Version Management

1. Pin model version via `VLLM_MODEL` in `.env` — never rely on `latest` tags for clinical deployment
2. All inference jobs record the model version in `audit_events.metadata.model_version`
3. After any model update: run the validation suite (see [Validation Guide](validation.md)) and monitor drift metrics for ≥2 weeks
4. Significant version changes require internal clinical validation before production deployment

---

## Related

- [Model Switching Guide](model-switching.md) — step-by-step backend replacement
- [Validation Guide](validation.md) — benchmarking and performance measurement
- [Inference Architecture](../architecture/medgemma-usage.md) — implementation details
- [GPU Setup](../admin/gpu-setup.md) — hardware requirements and configuration
- [Audit Logging](../compliance/audit-logging.md) — audit trail schema
- [Risk Management](../compliance/risk-management.md) — AI risk analysis
