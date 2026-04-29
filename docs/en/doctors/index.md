# Guide for Radiologists & Physicians

This section covers everything you need to use Radiolyze for daily radiological reporting.
No technical background is required.

![Radiolyze UI (screenshot)](../../assets/screenshot-radiolyze.png)

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

## Your First Report (step-by-step)

1. **Pick a study** from the worklist (left sidebar).
2. **Review the images** in the centre viewer (scroll frames/series, apply window presets).
3. **Enter findings** (type or dictate if ASR is enabled).
4. **(Optional) Generate an AI impression** and treat it as a draft you must edit/approve.
5. **Check QA** for missing sections or inconsistencies.
6. **Approve** to finalise the report.

If AI is not configured (no GPU overlay), you can still report normally and approve.

---

## The Reporting Screen at a Glance

<div class="grid cards" markdown>

-   :material-view-list: **Left Sidebar**

    Select studies from the worklist, navigate series, and open prior studies for side-by-side comparison with synchronised scrolling.

-   :material-monitor: **DICOM Viewer**

    Interactive image viewer with zoom, pan, windowing, and measurement tools. Supports multi-series navigation and frame scrolling.

-   :material-text-box-edit: **Right Panel**

    The reporting workspace: dictate or type findings, review the AI-generated impression, check QA warnings, apply templates, and approve the final report.

</div>

---

## Quick Reference: Viewer Tools

| Action | How |
|---|---|
| :material-magnify: Zoom | Scroll wheel or pinch |
| :material-cursor-move: Pan | Click and drag |
| :material-brightness-6: Window/Level | Right-click and drag |
| :material-tune: Window Presets | Toolbar presets (Lung, Bone, Soft Tissue…) |
| :material-arrow-left-right: Next/Previous Series | Arrow buttons in the viewer header |
| :material-layers-triple: Scroll through frames | Scroll wheel (single click first to focus) |

---

## Quick Reference: Reporting Steps

| Step | What to do |
|---|---|
| :material-numeric-1-circle: Select study | Click a study in the left worklist |
| :material-numeric-2-circle: Review images | Navigate series, apply windowing presets |
| :material-numeric-3-circle: Dictate or type findings | Click the microphone or type in the Findings panel |
| :material-numeric-4-circle: Request AI impression | Click "Generate Impression" |
| :material-numeric-5-circle: Review AI draft | Read, edit, or delete AI suggestion |
| :material-numeric-6-circle: QA check | Review warnings from the QA panel |
| :material-numeric-7-circle: Approve | Click "Approve" — the report is finalised |

---

## Common Questions

**The AI did not generate an impression. What happened?**  
The AI service may not be configured (no GPU overlay) — in that case, a mock response or error message appears. Contact your administrator. You can always write the impression manually.

**Voice dictation is not working.**  
Check that your browser has microphone permission. If using Whisper, confirm the service is running with your administrator.

**I cannot find my study.**  
Ask your administrator whether the study has been sent to the Orthanc PACS. Studies appear in the worklist only after being loaded into the system.

---

!!! warning "Research & teaching only"
    Radiolyze is **not** a medical device and is **not intended for clinical use or diagnostic purposes**.
    Use it **exclusively for research and education** (anonymised or synthetic data only).

    See: [Disclaimer](../legal/disclaimer.md)

---

*More guides coming in Phase 2: keyboard shortcuts, troubleshooting, and AI-specific guidance.*
