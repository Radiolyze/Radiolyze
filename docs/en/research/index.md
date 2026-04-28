# Guide for Researchers & AI Specialists

This section covers the AI subsystem of Radiolyze: the MedGemma model, the inference pipeline,
how to replace or extend the AI backend, and how to validate outputs.

---

## AI System Overview

Radiolyze uses a **multimodal AI pipeline** to generate radiological report drafts from DICOM images:

```
DICOM Frames (JPEG)
        │
        ▼
  Inference Client          backend/app/inference_clients.py
  (OpenAI-compatible)
        │
        ▼
    vLLM Server             GPU Docker container
  + MedGemma Model          google/medgemma-4b-it (default)
        │
        ▼
  Findings + Impression     Structured text returned to UI
  Draft Text
```

**Key properties:**
- The inference endpoint is **OpenAI API-compatible** (`/v1/chat/completions`)
- Images are sent as base64-encoded JPEG frames (sampled from DICOM stacks)
- Number of frames is configurable: `VITE_INFERENCE_MAX_FRAMES_CURRENT` (default: 16)
- All prompts are customisable in `backend/app/prompts.py`

---

## MedGemma Model

### What it is

[MedGemma](https://huggingface.co/google/medgemma) is a multimodal language model by Google,
fine-tuned on medical imaging data. It receives images and text instructions and produces
structured medical text.

### Capabilities

- Generating findings descriptions from chest X-rays, CT, and MR images
- Drafting radiological impressions from structured findings text
- Following structured output formats defined in prompt templates

### Limitations and Known Issues

!!! warning "Clinical validation required"
    MedGemma is a research model. Its outputs have **not been clinically validated** for the
    specific patient population, image quality, and use cases of your institution. Do not use
    AI outputs without radiologist review.

| Limitation | Details |
|---|---|
| Hallucinations | The model can generate plausible-sounding but incorrect findings |
| Image quality sensitivity | Low-quality or non-standard imaging reduces accuracy |
| Modality coverage | Best performance on chest X-ray; CT/MR performance varies by sequence |
| Language | Outputs are in English by default; multilingual prompting reduces quality |
| Rare findings | Uncommon pathologies may be missed or mischaracterised |
| No patient history | Model has no access to clinical context beyond the images and prompt |

### Bias Considerations

- Training data demographics may differ from your patient population
- Performance may vary across patient age, sex, and body habitus
- Local clinical validation is essential before any clinical deployment

Full model card: [MedGemma Model Card](../compliance/model-card-medgemma.md)

---

## Switching the Inference Backend

The inference client uses an **OpenAI-compatible REST API**. To switch to a different model:

### 1. Change environment variables

```bash
# In .env
INFERENCE_BASE_URL=http://localhost:8001/v1   # your vLLM / Ollama endpoint
INFERENCE_MODEL=your-model-name               # model identifier
```

### 2. Supported backends

| Backend | Notes |
|---|---|
| **vLLM** (default) | Best performance for large models, NVIDIA GPU |
| **Ollama** | Easy setup, broader hardware support, lower throughput |
| **OpenAI API** | Cloud fallback; sends images externally — consider PHI implications |
| **Any OpenAI-compatible server** | LM Studio, llama.cpp server, etc. |

### 3. Verify the connection

```bash
curl http://localhost:8001/v1/models
```

The backend health check at `GET /api/v1/health` also reports the inference service status.

---

## Customising Prompts

All prompt templates are in `backend/app/prompts.py`. Key templates:

| Template | Purpose |
|---|---|
| `FINDINGS_SYSTEM_PROMPT` | System role for findings generation |
| `FINDINGS_USER_TEMPLATE` | Per-request findings prompt with image injection |
| `IMPRESSION_SYSTEM_PROMPT` | System role for impression drafting |
| `IMPRESSION_USER_TEMPLATE` | Impression generation from findings text |

Changes take effect immediately on the next inference call — no restart required.

---

## Data Flow for Privacy Analysis

```
Browser (React)
  │  JPEG frames (base64, sampled from DICOM)
  │  HTTP POST /api/v1/inference/findings
  ▼
FastAPI Backend
  │  Enqueues job in Redis (RQ)
  │  No PHI stored in queue payload (DICOM tags stripped)
  ▼
RQ Worker
  │  Sends frames + prompt to vLLM (internal Docker network)
  │  Records: job_id, model_version, duration, image_hash → audit_events
  ▼
vLLM / MedGemma
  │  Processes images locally (no external calls)
  ▼
Backend → Browser: inference result (text only)
```

**PHI handling:**
- DICOM pixel data is encoded as JPEG and sent only to the local vLLM service
- Patient metadata (name, DOB, ID) is never included in inference payloads
- Audit logs store hashes, not raw image data
- No data leaves the Docker network during inference

---

## Validation & Benchmarking

To validate model performance for your use case:

1. **Collect a reference dataset** — studies with known ground-truth reports (anonymised).
2. **Run inference** — use `POST /api/v1/inference/findings` on each study.
3. **Compare outputs** — use NLP metrics (BLEU, ROUGE, BERTScore) or clinical scoring.
4. **Log results** — findings and audit events are stored in PostgreSQL for analysis.

Export audit data for analysis:

```bash
GET /api/v1/audit?export=json
```

The `evidence_indices` field in audit events maps AI outputs to specific image frames,
enabling localised accuracy analysis.

---

## Contributing AI Improvements

To contribute prompt improvements, model evaluations, or new inference backends:

1. Read the [Contributing Guidelines](../development/contributing.md).
2. Open a GitHub issue describing your proposed change.
3. For prompt changes: edit `backend/app/prompts.py` and include before/after examples in the PR.
4. For new inference backends: implement the client interface in `backend/app/inference_clients.py`.

---

*Detailed guides for adding a new inference backend, benchmarking methodology, and RAG integration are planned for Phase 3 of the documentation.*
