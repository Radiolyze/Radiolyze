# Prompting: User Configuration and Templates

## Goal
Prompts for image analysis/impression should be user-configurable
without a code deployment. At the same time, safe defaults should be
available as templates.

## Current State (Reference)
- `backend/app/inference_clients.py` uses:
  - `VLLM_SYSTEM_PROMPT`
  - `VLLM_IMAGE_SUMMARY_PROMPT`
  - `VLLM_IMAGE_IMPRESSION_PROMPT`
- Prompts are currently driven by environment variables and are not editable via the UI.

## Plan: User-Editable Prompts
1) Data storage
   - Table `prompt_templates`
     - `id`, `name`, `type` (system|summary|impression)
     - `template_text`
     - `variables` (JSON, optional)
     - `version`, `is_active`
     - `created_by`, `created_at`, `updated_at`
   - Optional: `prompt_audit` for change history (diff, hash).

2) API
   - `GET /api/v1/prompts` (list, including active version)
   - `GET /api/v1/prompts/{type}` (active version)
   - `PUT /api/v1/prompts/{type}` (update + new version)
   - Validation:
     - Max length (e.g. 4000 chars)
     - Allowed placeholders (allowlist)
     - No empty prompts

3) Backend Runtime
   - Prompt lookup per request, with cache (e.g. 30s)
   - Fallback: ENV defaults if no entry is active
   - Unified rendering: `render_prompt(template, variables)`

4) Security & Compliance
   - Audit events: `prompt_updated`, `prompt_activated`
   - UI role "admin" required for editing
   - UI displays warnings: "no PHI, no patient data"

5) UI
   - Settings page with:
     - Editor, preview, reset to default
     - Test run (optional) with sample images
     - Version comparison

6) Rollout
   - Feature flag `PROMPT_CONFIG_ENABLED`
   - Start: read-only (display only), then enable editing

## Template: Optimized Prompts
Note: Templates are intentionally short, robust, and safe.
Placeholders in `{{...}}` can be filled in later via a template engine.

### 1) System Prompt (v1)
```
You are a radiology assistant.
Focus only on visible imaging findings.
Be concise and avoid speculation.
If evidence is insufficient, state the limitation.
Do not include patient identifiers or PHI.
Use the same language as the provided findings text when possible.
```

### 2) Image Summary Prompt (v1)
```
Task: Summarize the imaging findings from the provided images.
If findings text is provided, align with it and correct only obvious conflicts.
If findings text is empty, rely solely on the images.
Output: 1-2 sentences.
Return a JSON object with keys:
- summary (string)
- evidence_indices (array of integers, optional; refer to image manifest indices)
- limitations (string, optional)
Return only valid JSON. No markdown or code fences.

Image manifest:
{{image_manifest}}

Findings (optional):
{{findings_text}}
```

### 3) Impression Prompt (v1)
```
Task: Draft a concise radiology impression based on the images and findings.
Prioritize the most clinically relevant findings.
If uncertain, qualify with "likely" or "cannot exclude".
Output: 1-3 short sentences.
Return a JSON object with keys:
- impression (string)
- comparison (string, optional)
- evidence_indices (array of integers, optional; refer to image manifest indices)
- confidence (string, optional: low|medium|high)
Return only valid JSON. No markdown or code fences.

Image manifest:
{{image_manifest}}

Findings (optional):
{{findings_text}}
```

### 4) Optional: Strict Safety Variant (v1)
```
You must not infer diagnosis beyond visible imaging evidence.
If no abnormality is visible, state "No acute abnormality identified."
If image quality is limited, state the limitation.
Return only the requested text.
```
