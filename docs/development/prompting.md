# Prompting: Benutzerkonfiguration und Vorlagen

## Ziel
Prompts fuer Bildanalyse/Impression sollen durch Benutzer konfigurierbar
sein, ohne Code-Deploy. Gleichzeitig sollen sichere Defaults als Vorlagen
bereitstehen.

## Aktueller Stand (Referenz)
- `backend/app/inference_clients.py` nutzt:
  - `VLLM_SYSTEM_PROMPT`
  - `VLLM_IMAGE_SUMMARY_PROMPT`
  - `VLLM_IMAGE_IMPRESSION_PROMPT`
- Prompts sind heute ENV-getrieben und nicht per UI editierbar.

## Plan: Benutzer-editierbare Prompts
1) Datenhaltung
   - Tabelle `prompt_templates`
     - `id`, `name`, `type` (system|summary|impression)
     - `template_text`
     - `variables` (JSON, optional)
     - `version`, `is_active`
     - `created_by`, `created_at`, `updated_at`
   - Optional: `prompt_audit` fuer Aenderungsverlauf (Diff, Hash).

2) API
   - `GET /api/v1/prompts` (Liste, inkl. aktiver Version)
   - `GET /api/v1/prompts/{type}` (aktive Version)
   - `PUT /api/v1/prompts/{type}` (Update + neue Version)
   - Validierung:
     - Max Laenge (z.B. 4000 chars)
     - Erlaubte Platzhalter (Allowlist)
     - Keine leeren Prompts

3) Backend Runtime
   - Prompt-Lookup pro Request, mit Cache (z.B. 30s)
   - Fallback: ENV-Defaults, falls kein Eintrag aktiv
   - Einheitliches Rendering: `render_prompt(template, variables)`

4) Sicherheit & Compliance
   - Audit-Events: `prompt_updated`, `prompt_activated`
   - UI-Rolle "admin" zum Editieren
   - UI zeigt Warnungen: "keine PHI, keine Patientendaten"

5) UI
   - Settings-Seite mit:
     - Editor, Preview, Reset to Default
     - Testlauf (optional) mit Beispielbildern
     - Versionsvergleich

6) Rollout
   - Feature-Flag `PROMPT_CONFIG_ENABLED`
   - Start: Read-only (nur Anzeige), dann Editieren freischalten

## Vorlage: Optimierte Prompts
Hinweis: Templates sind absichtlich kurz, robust und sicher.
Platzhalter in `{{...}}` koennen spaeter via Template-Engine befuellt werden.

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
Output: 1-2 sentences, no bullet points, no headings.
Return only the summary text.

Findings (optional):
{{findings_text}}
```

### 3) Impression Prompt (v1)
```
Task: Draft a concise radiology impression based on the images and findings.
Prioritize the most clinically relevant findings.
If uncertain, qualify with "likely" or "cannot exclude".
Output: 1-3 short sentences, no bullet points, no headings.
Return only the impression text.

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
