# Workflows Overview

Radiolyze is optimised for three core reporting workflows. Choose the one that matches your case:

| Workflow | Best for | Typical time |
|---|---|---|
| [Fast Reporting](fast-report.md) | Single routine study (CXR, plain film) | 5–10 minutes |
| [Complex Case](complex-case.md) | CT/MR with multiple series, prior comparison | 15–30 minutes |
| [Batch Reporting](batch-reporting.md) | High-volume queue processing | 2–5 minutes per case |

---

## Common Workflow Pattern

All three workflows follow the same fundamental pattern:

```
1. Select study      ← Worklist sidebar
2. Review images     ← DICOM Viewer (centre panel)
3. Document findings ← Findings Panel (right, voice or typed)
4. AI impression     ← AI draft generated from findings + images
5. QA check          ← Automated quality checks
6. Approve           ← Mandatory review and sign-off
```

The right panel guides you through steps 3–6 with a progress indicator.

---

## Which Workflow Should I Use?

```
Start
 │
 ├─ Is this a chest X-ray or plain film?
 │   └─ YES → Fast Reporting
 │
 ├─ Does the study have multiple series or priors to compare?
 │   └─ YES → Complex Case
 │
 └─ Am I processing a queue of multiple studies back-to-back?
     └─ YES → Batch Reporting
```

---

## AI Assistance in All Workflows

In every workflow, the AI model (MedGemma) is available to:

- **Analyse images** and suggest findings
- **Draft an impression** from your documented findings
- Flag potential inconsistencies via **QA checks**

The AI is optional — you can always write findings and impressions manually. All AI outputs require your explicit approval before the report is saved.

!!! info "No AI on CPU-only deployments"
    Without a GPU, AI inference returns a mock response. Voice dictation (Whisper) and manual typing always work regardless of GPU availability.

---

## Keyboard Shortcuts in All Workflows

| Shortcut | Action |
|---|---|
| `Ctrl + M` | Toggle voice dictation microphone |
| `Ctrl + S` | Save draft |
| `Ctrl + Enter` | Approve report |
| `?` | Show keyboard shortcut help |

Full reference: [Keyboard Shortcuts](../doctors/tastenkuerzel.md)

---

## Audit and Compliance

Every completed report is logged in the audit trail with:

- Radiologist identity and timestamp
- AI model version and confidence
- All edits between AI draft and final approved text
- QA check results

This satisfies EU AI Act Article 12 (logging and traceability) and Article 14 (human oversight).
