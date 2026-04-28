# ASR Provider Guide

How to configure, switch, and extend the speech recognition (ASR) provider in Radiolyze.

---

## Architecture Overview

The ASR pipeline lives entirely in `backend/app/asr_providers.py`. The backend exposes one function — `transcribe_audio()` — which selects the correct provider based on environment variables and posts audio to an OpenAI-compatible `/v1/audio/transcriptions` endpoint.

```
Frontend mic → WebSocket → API /audio/transcribe
  → transcribe_audio()
    ├── ASR_ENABLED=false → mock (returns canned text)
    ├── ASR_PROVIDER=medasr → MedASR service (default)
    └── ASR_PROVIDER=whisper → Whisper-compatible service
```

Audio is processed **in-memory only**. No audio is written to disk or stored in the database. The audit log records only a SHA-256 hash of the audio blob and its duration.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ASR_ENABLED` | `false` | Master switch — enables real ASR (overrides `MEDASR_ENABLED`) |
| `ASR_PROVIDER` | `medasr` | Provider selection: `medasr` or `whisper` (any openai_audio-compatible value) |
| `MEDASR_ENABLED` | `false` | Legacy switch (used if `ASR_ENABLED` not set) |
| `MEDASR_BASE_URL` | `http://medasr:8001` | MedASR service URL |
| `MEDASR_TRANSCRIBE_PATH` | `/v1/audio/transcriptions` | Transcription endpoint path |
| `MEDASR_MODEL` | `google/medasr` | Model name sent in the request |
| `MEDASR_REQUEST_TIMEOUT` | `60` | Request timeout in seconds |
| `MEDASR_API_KEY` | *(none)* | Optional Bearer token for the MedASR service |
| `MEDASR_FALLBACK_TO_MOCK` | `true` | Fall back to mock transcript on ASR failure |
| `ASR_OPENAI_BASE_URL` | *(uses MEDASR_BASE_URL)* | Override base URL for Whisper/OpenAI-compatible provider |
| `ASR_OPENAI_TRANSCRIBE_PATH` | *(uses MEDASR path)* | Override transcription path |
| `ASR_OPENAI_MODEL` | *(uses MEDASR_MODEL)* | Override model name for OpenAI-compatible provider |
| `ASR_OPENAI_API_KEY` | *(uses MEDASR_API_KEY)* | Override API key for OpenAI-compatible provider |
| `ASR_OPENAI_REQUEST_TIMEOUT` | `60` | Timeout for OpenAI-compatible provider |
| `ASR_SEND_LANGUAGE` | `true` | Whether to send the `language` field in the request |
| `MEDASR_DEFAULT_CONFIDENCE` | `0.0` | Confidence score when the provider does not return one |

---

## Provider: Mock (Default for Development)

When `ASR_ENABLED=false` (the default), `transcribe_audio()` returns a canned transcript from `backend/app/mock_logic.py`. This is suitable for frontend development and unit tests — no ASR service required.

```bash
# .env (development)
ASR_ENABLED=false
```

---

## Provider: MedASR (Medical-Optimised GPU ASR)

MedASR is a medical-vocabulary-optimised speech recognition service with an OpenAI-compatible API. It requires a GPU.

```bash
# .env
ASR_ENABLED=true
ASR_PROVIDER=medasr
MEDASR_BASE_URL=http://medasr:8001
MEDASR_MODEL=google/medasr

# Start with MedASR included
docker compose --profile gpu up --build
```

The `medasr` Docker service is defined in `docker/compose/gpu.yml`. MedASR listens on port 8001 inside the Docker network.

**Verify MedASR is running:**

```bash
curl http://localhost:8001/v1/models
docker compose logs medasr --tail=20
```

---

## Provider: Whisper (CPU or GPU, Multilingual)

[Faster-Whisper](https://github.com/guillaumekln/faster-whisper) is an open-source multilingual ASR model. It supports CPU inference, making it usable without a GPU. It provides an OpenAI-compatible API.

```bash
# .env
ASR_ENABLED=true
ASR_PROVIDER=whisper
ASR_OPENAI_BASE_URL=http://whisper-asr:9000
ASR_OPENAI_MODEL=whisper-1

# or use the env.whisper.example preset:
cp .env.whisper.example .env

# Start with Whisper overlay
docker compose \
  -f docker-compose.yml \
  -f docker/compose/whisper.yml \
  up --build
```

**Model selection (Whisper):**

```bash
# .env — choose model size
WHISPER_MODEL=base        # 74M params — fast, good for EN
WHISPER_MODEL=small       # 244M — better accuracy
WHISPER_MODEL=medium      # 769M — multilingual quality
WHISPER_MODEL=large-v3    # 1.5B — best accuracy, requires more RAM
```

The first startup downloads the selected model; this can take several minutes.

**Verify Whisper is running:**

```bash
curl http://localhost:9000/v1/models
docker compose logs whisper-asr --tail=20
```

---

## Combining GPU Inference + Whisper

To run both vLLM (MedGemma) and Whisper-ASR simultaneously:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker/compose/gpu.yml \
  -f docker/compose/whisper.yml \
  --profile gpu \
  up --build
```

In this configuration, vLLM uses the GPU and Whisper uses CPU (or GPU if enough VRAM remains).

---

## Adding a Custom ASR Provider

Any service that implements the OpenAI `/v1/audio/transcriptions` endpoint can be used. The request format is:

```http
POST /v1/audio/transcriptions
Content-Type: multipart/form-data

file=<audio_blob>
model=<model_name>
language=<iso_639_1_code>  (optional)
```

Expected response:

```json
{
  "text": "The transcribed text here."
}
```

To integrate a custom provider:

1. Stand up a service implementing the above API
2. Set environment variables:

```bash
ASR_ENABLED=true
ASR_PROVIDER=openai_audio  # or any value except "medasr"
ASR_OPENAI_BASE_URL=http://your-service:PORT
ASR_OPENAI_MODEL=your-model-name
ASR_OPENAI_TRANSCRIBE_PATH=/v1/audio/transcriptions
ASR_OPENAI_API_KEY=your-key  # if required
```

3. Restart the backend: `docker compose restart backend`
4. Test with the mic in the report workspace

No code changes are required for standard OpenAI-compatible providers.

---

## Language Support

The frontend sends the browser's language code (e.g. `de-DE`) with each audio upload. The `normalize_asr_language()` function converts this to ISO 639-1 (`de`) before sending it to the ASR service.

```python
# backend/app/asr_providers.py
def normalize_asr_language(language: str | None) -> str | None:
    """Map BCP-47 tags (e.g. de-DE) to ISO-639-1 for OpenAI-style ASR APIs."""
```

To disable language hinting (some providers ignore it or error on it):

```bash
ASR_SEND_LANGUAGE=false
```

---

## Fallback Behaviour

If ASR fails (network error, service unavailable, timeout), the backend:

1. Logs a warning with the error details
2. Falls back to the mock transcript (if `MEDASR_FALLBACK_TO_MOCK=true`)
3. Returns the mock text to the frontend with `provider: mock` in metadata

The radiologist sees a canned phrase in the dictation field and can type their findings manually. The workflow is never blocked by ASR failure.

To disable the fallback (and surface the error to the caller instead):

```bash
MEDASR_FALLBACK_TO_MOCK=false
```

---

## Testing ASR Integration

```bash
# 1. Check the backend picks up the right provider
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool

# 2. Run the ASR provider unit tests
cd backend
python -m pytest tests/test_asr_providers.py -v

# 3. Manual audio test (requires a WAV/MP3 file)
curl -X POST http://localhost:8000/api/v1/audio/transcribe \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample.wav" \
  -F "language=de"
```

---

## Audit Trail

Every transcription call (real or mock) creates an audit event:

```json
{
  "event_type": "asr_completed",
  "actor_id": "user-abc",
  "report_id": "r-123",
  "metadata": {
    "provider": "whisper",
    "audio_hash": "a3f8b2c1d4e5f6a7",
    "audio_length_bytes": 48200,
    "latency_ms": 1240
  }
}
```

Audio content is never stored. Only the hash and size are written.

---

## Related

- [GPU Setup](../admin/gpu-setup.md) — NVIDIA/AMD prerequisites for MedASR
- [Model Switching](../research/model-switching.md) — switching the inference backend
- [Development Setup](setup.md) — local dev environment
- [Testing](testing.md) — running ASR tests
