# Model Switching Guide

Step-by-step guide for replacing or upgrading the AI inference backend in Radiolyze.

---

## Supported Backends

Radiolyze uses an OpenAI-compatible chat completions API to talk to the inference backend. Any backend that implements this API can be used.

| Backend | Description | Use case |
|---|---|---|
| **vLLM + MedGemma** | Default — GPU-accelerated local inference | Production (GPU server) |
| **vLLM + other model** | Any HuggingFace model served via vLLM | Research / experimentation |
| **Ollama** | Local CPU/GPU inference, simpler setup | Development / low-resource |
| **OpenAI API** | Cloud inference (GPT-4o, GPT-4V) | Evaluation / no GPU available |
| **Groq / Together AI** | Third-party OpenAI-compatible endpoints | Evaluation / fallback |

!!! warning "Privacy: cloud backends"
    Cloud backends (OpenAI, Groq, Together AI) send DICOM image data and findings text to external servers. This is **incompatible with clinical use** unless explicit patient consent and a Data Processing Agreement are in place. Use cloud backends for evaluation only, with anonymised or synthetic data.

---

## How the Backend is Configured

All backend settings are in `.env`:

```bash
# Which model to load in vLLM
VLLM_MODEL=google/medgemma-4b-it

# Base URL of the OpenAI-compatible endpoint
VLLM_BASE_URL=http://vllm:8000

# Inference parameters
VLLM_TEMPERATURE=0.1
VLLM_MAX_TOKENS=512
```

The FastAPI backend reads these at startup and sends all inference requests to `VLLM_BASE_URL`. No code changes are needed to switch backends — only `.env` and optionally `docker-compose.yml`.

---

## Switching MedGemma 4B → 27B

**Requirements:** GPU with ≥ 40 GB VRAM (e.g. A100 80 GB, two A100 40 GB).

```bash
# 1. Edit .env
VLLM_MODEL=google/medgemma-27b-it

# 2. Accept Hugging Face terms for medgemma-27b-it (if not already done)
# Visit: https://huggingface.co/google/medgemma-27b-it

# 3. For multi-GPU, edit docker/compose/gpu.yml
#    Add --tensor-parallel-size 2 to vllm command args

# 4. Restart vLLM
docker compose restart vllm

# 5. Monitor VRAM
watch -n 2 nvidia-smi

# 6. Verify model loaded
curl http://localhost:8001/v1/models
```

Expected VRAM usage: ~28 GB (4B) → ~55 GB (27B).

---

## Switching to a Different HuggingFace Model

Radiolyze works with any multimodal model that supports the OpenAI chat completions format with image inputs.

**Compatibility requirements:**
- Must support `image_url` content in messages
- Must support `guided_json` parameter (or equivalent structured output)
- Must accept the prompt format used in `backend/app/inference_clients.py`

```bash
# 1. Edit .env
VLLM_MODEL=your-org/your-model-name

# 2. Set Hugging Face token if the model is gated
HUGGINGFACE_HUB_TOKEN=hf_xxxxxxxxxxxxxxxxxx

# 3. Restart vLLM to load the new model
docker compose restart vllm

# 4. Check model loaded correctly
curl http://localhost:8001/v1/models
docker compose logs vllm --tail=50
```

**Prompt compatibility:** The system prompt in `backend/app/inference_clients.py` is tuned for MedGemma. If switching to a different model family, review and test the prompt — other models may require different formatting or instruction styles.

---

## Switching to Ollama

Ollama provides a simpler setup for development, useful when no GPU is available.

```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a vision model (e.g. llava-med or llava)
ollama pull llava

# 3. Ollama exposes an OpenAI-compatible API on port 11434
# Edit .env:
VLLM_BASE_URL=http://host.docker.internal:11434
VLLM_MODEL=llava

# 4. Restart backend
docker compose restart backend worker

# 5. Test
curl http://host.docker.internal:11434/v1/models
```

!!! note "Image support"
    Not all Ollama models support image inputs. Use a vision-capable model (`llava`, `llava-llama3`, `bakllava`). Medical-quality outputs will be lower than MedGemma.

---

## Switching to OpenAI API (Evaluation Only)

!!! danger "Not for clinical use"
    Patient data would leave your network. Only use with anonymised / synthetic data.

```bash
# Edit .env
VLLM_BASE_URL=https://api.openai.com
VLLM_MODEL=gpt-4o

# Add OpenAI API key
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# The backend uses VLLM_BASE_URL — rename in your .env if needed:
# Some installations use a wrapper; check backend/app/inference_clients.py
```

The OpenAI API supports `image_url` content and structured JSON output (`response_format: json_object`), so it is compatible with the Radiolyze prompt format.

---

## Prompt Compatibility Testing

After switching any backend, verify the prompt works correctly:

### 1. Manual test via API

```bash
curl -X POST http://localhost:8000/api/v1/inference/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "study_id": "YOUR_TEST_STUDY_ID",
    "modality": "CXR"
  }'
```

Check the response:
- `impression` field is populated with coherent text
- `key_findings` is a valid JSON array
- `evidence_indices` is a valid integer array

### 2. Check audit log

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/audit?event_type=inference_completed&limit=5"
```

Verify `model_version` in the audit event matches your new model.

### 3. Compare output quality

Run the same study through the old and new model and compare impressions side by side. Key things to check:

- Correct anatomical terminology
- No hallucinated findings
- Evidence indices map to plausible frames
- JSON structure parses correctly

---

## Structured Output — Prompt Compatibility Table

Different models have different capabilities for structured output:

| Backend | `guided_json` | `response_format: json_object` | Notes |
|---|---|---|---|
| vLLM | ✅ Yes | ✅ Yes | Use `guided_json` for schema enforcement |
| Ollama | ✅ Yes (recent) | ✅ Yes | Ollama ≥ 0.3 required |
| OpenAI API | — | ✅ Yes | Use `response_format` in request |
| Groq | — | ✅ Yes | JSON mode supported |

The backend automatically uses `guided_json` for vLLM. If you switch to a backend that does not support it, you may need to adjust `backend/app/inference_clients.py` to use `response_format` instead.

---

## After Switching: Drift Monitoring

After any model change, monitor quality for at least 2 weeks:

```bash
# Check QA acceptance rate
curl http://localhost:8000/api/v1/monitoring/drift

# Watch audit log for inference errors
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/audit?event_type=inference_failed&limit=20"
```

Alert thresholds to watch:
- Inference error rate > 5% → investigate prompt or model compatibility
- QA pass rate drops > 10 percentage points → model output format may have changed
- Inference latency increases > 2× → GPU resource or context length issue

---

## Reverting to Previous Model

Model configuration is stored only in `.env`. Reverting is instant:

```bash
# Edit .env — restore previous VLLM_MODEL value
VLLM_MODEL=google/medgemma-4b-it

# Restart vLLM
docker compose restart vllm

# Verify
curl http://localhost:8001/v1/models
```

All audit events record the model version at the time of inference, so historical reports remain fully traceable even after a model change.

---

## Related

- [MedGemma Deep Dive](medgemma.md) — model architecture, benchmarks, configuration
- [Validation Guide](validation.md) — how to benchmark a new model
- [GPU Setup](../admin/gpu-setup.md) — hardware requirements
- [Inference Architecture](../architecture/medgemma-usage.md) — implementation details
- [Audit Logging](../compliance/audit-logging.md) — model version traceability
