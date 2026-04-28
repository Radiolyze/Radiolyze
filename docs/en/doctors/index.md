# Guide for Radiologists & Physicians

This section covers everything you need to use Radiolyze for daily radiological reporting.
No technical background is required.

---

## What you can do with Radiolyze

- **Open and navigate** DICOM studies from the worklist
- **Dictate findings** hands-free using voice recognition (ASR)
- **Review an AI draft** of the impression generated from the images
- **Compare with prior studies** side by side with synchronised scrolling
- **Apply report templates** for consistent, structured reporting
- **Approve and finalise** the report with a mandatory review step

---

## Your Role in the AI Workflow

!!! info "You are always in control"
    Radiolyze AI generates **draft text only**. Every AI output must be reviewed and explicitly approved by you before the report is saved. The system is designed to assist, not to replace clinical judgment.

    If you disagree with the AI suggestion, simply edit or delete it.

---

## Learning Path

If you are new to Radiolyze, work through these topics in order:

1. **[Fast Reporting Workflow](../workflows/fast-report.md)** — the standard workflow for a chest X-ray from queue to approval in under 10 minutes.
2. **[Complex Case Workflow](../workflows/complex-case.md)** — CT/MR studies with prior comparisons and multiple series.
3. **[Batch Reporting](../workflows/batch-reporting.md)** — processing multiple studies from a queue efficiently.

---

## The Reporting Screen at a Glance

```
┌───────────────┬──────────────────────────┬─────────────────────┐
│  Left Sidebar │      DICOM Viewer         │    Right Panel      │
│               │                          │                     │
│  Worklist     │  Images / Series         │  Findings           │
│  Patient Info │  Viewer Tools            │  Impression (AI)    │
│  Prior Studies│  Windowing Presets       │  QA Status          │
│               │                          │  Templates          │
└───────────────┴──────────────────────────┴─────────────────────┘
```

**Left Sidebar** — select studies, navigate series, view prior studies for comparison.

**DICOM Viewer** — interactive image viewer with zoom, pan, windowing, and measurement tools.

**Right Panel** — the reporting workspace: dictate findings, review the AI impression, check QA, and approve.

---

## Quick Reference: Viewer Tools

| Action | How |
|---|---|
| Zoom | Scroll wheel or pinch |
| Pan | Click and drag |
| Window/Level | Right-click and drag |
| Window Presets | Toolbar presets (Lung, Bone, Soft Tissue…) |
| Next/Previous Series | Arrow buttons in the viewer header |
| Scroll through frames | Scroll wheel (single click first to focus) |

---

## Quick Reference: Reporting Steps

| Step | What to do |
|---|---|
| 1. Select study | Click a study in the left worklist |
| 2. Review images | Navigate series, apply windowing presets |
| 3. Dictate or type findings | Click the microphone or type in the Findings panel |
| 4. Request AI impression | Click "Generate Impression" |
| 5. Review AI draft | Read, edit, or delete AI suggestion |
| 6. QA check | Review warnings from the QA panel |
| 7. Approve | Click "Approve" — the report is finalised |

---

## Common Questions

**The AI did not generate an impression. What happened?**  
The AI service may not be configured (no GPU overlay) — in that case, a mock response or error message appears. Contact your administrator. You can always write the impression manually.

**Voice dictation is not working.**  
Check that your browser has microphone permission. If using Whisper, confirm the service is running with your administrator.

**I cannot find my study.**  
Ask your administrator whether the study has been sent to the Orthanc PACS. Studies appear in the worklist only after being loaded into the system.

---

!!! warning "Not for clinical use without validation"
    Radiolyze is a reference implementation. Clinical deployment requires authentication, TLS, and local clinical validation. Confirm with your institution's IT and compliance teams before use with real patient data.

---

*More guides coming in Phase 2: keyboard shortcuts, troubleshooting, and AI-specific guidance.*
