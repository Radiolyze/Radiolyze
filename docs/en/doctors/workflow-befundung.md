# Clinical Reporting Workflow

This page walks through the complete reporting workflow step by step — from selecting a study in the worklist to signing off the final report.

---

## Overview

A standard reporting session follows this sequence:

```
Worklist → Images → Findings → AI Impression → QA → Approval
```

Total time for a routine chest X-ray: approximately 5–10 minutes.

---

## Step 1: Select a Study from the Worklist

The left sidebar shows the study queue. Each entry displays:

- Patient name and ID
- Modality (CXR, CT, MR…)
- Study date
- Priority indicator (urgent studies are highlighted)

**Click any study** to load it. The DICOM viewer in the centre panel opens automatically.

!!! tip "Sorting and filtering"
    The worklist can be sorted by date or priority. Use the filter icon at the top of the sidebar to narrow the list by modality or date range.

---

## Step 2: Review the Images

Once the study loads:

1. **Navigate series** — use the series list in the sidebar to switch between sequences (e.g., axial / coronal / sagittal for CT, or PA / lateral for CXR).
2. **Scroll through slices** — mouse scroll or `↑`/`↓` arrow keys move through the image stack.
3. **Adjust windowing** — click a preset in the toolbar (Lung, Bone, Soft Tissue, Abdomen…) or right-click and drag to adjust manually.
4. **Use measurement tools** — press `M` to activate the ruler tool for lesion sizing.
5. **Compare with prior studies** — click a prior study in the Prior Studies panel (bottom of the left sidebar) to open it in split view.

!!! info "Image quality"
    If images appear distorted or do not load, check the DICOMweb connection with your administrator. Poor image quality reduces AI accuracy.

---

## Step 3: Dictate or Type Findings

Open the **Findings panel** in the right column.

### Option A: Voice Dictation (ASR)

1. Click the **microphone button** or press `Ctrl + M`.
2. Speak your findings clearly and at a normal pace.
3. The transcription appears in real time in the text field.
4. Click the microphone again or press `Ctrl + M` to stop.
5. Review and correct the transcription text.

### Option B: Typed Entry

Click directly into the Findings text field and type your findings.

### Findings Structure

Structure findings by organ system or anatomical region for best AI impression quality, for example:

```
Lungs: No consolidation, no pleural effusion.
Heart: Normal cardiac silhouette.
Mediastinum: No widening.
Bones: No acute fracture.
```

---

## Step 4: Request AI Impression

Click **"Generate Impression"** in the Impression panel.

The system sends your findings text and a sample of the DICOM images to the AI model. A progress indicator appears while the AI processes (typically 10–30 seconds with GPU, or a mock response without GPU).

The AI draft appears in the Impression text field.

!!! warning "Always review the AI output"
    Read every line of the AI impression before accepting it. The AI can generate plausible but incorrect text. You are responsible for the final report.

---

## Step 5: Review and Edit the AI Draft

After the draft appears:

1. **Read the entire impression** — compare with your own findings and the images.
2. **Edit where needed** — click into the text field and modify any part of the draft.
3. **Delete if necessary** — if the draft is unsuitable, clear the field and write the impression manually.
4. **Check for hallucinations** — AI can describe findings not visible in the images. Compare every stated finding against what you see.

Common AI errors to watch for:

| AI behaviour | What to check |
|---|---|
| Describes a finding you did not see | Re-examine the relevant image region |
| Misses an obvious finding | Manually add it to the impression |
| Uses incorrect laterality (left/right) | Verify against images carefully |
| Overstates severity | Downgrade to match actual imaging |
| Uses non-standard terminology | Rewrite in your institution's preferred style |

---

## Step 6: Check the QA Panel

The **QA panel** (right column, below the Impression) runs automated checks on your report:

| Check | What it tests |
|---|---|
| Findings present | At least one finding documented |
| Impression present | Impression text not empty |
| Laterality consistency | Left/right terms match in findings and impression |
| Report length | Impression not suspiciously short |

**Green:** All checks passed.  
**Yellow:** Warning — review the flagged item.  
**Red:** Blocking issue — resolve before approval.

---

## Step 7: Approve the Report

When you are satisfied with the report:

1. Click **"Approve"** in the Impression panel — or press `Ctrl + Enter`.
2. An approval dialog appears showing the final report text.
3. Confirm your identity (if authentication is configured).
4. Click **"Confirm Approval"**.

The report is saved to the database and logged in the audit trail with your identity, timestamp, and the AI model version used.

!!! info "What happens after approval"
    The report is stored as a DICOM Structured Report (SR). If DICOM SR export is configured, it is sent back to Orthanc. The audit log records every AI interaction and your approval action.

---

## Workflow Differences by Modality

| Modality | Specific steps |
|---|---|
| **Chest X-ray (CXR)** | Usually one series; use PA/lateral toggle if both projections loaded |
| **CT (Abdomen, Thorax)** | Navigate axial, coronal, sagittal; use windowing presets; compare with priors for size |
| **MR** | Navigate multiple sequences; check FLAIR, DWI, T1, T2 as relevant; no radiation dose concern |
| **Batch mode** | See [Batch Reporting Workflow](../workflows/batch-reporting.md) |

---

## Keyboard Shortcuts for This Workflow

| Action | Shortcut |
|---|---|
| Toggle microphone | `Ctrl + M` |
| Save draft | `Ctrl + S` |
| Approve report | `Ctrl + Enter` |
| Reset viewer | `R` |
| Measure tool | `M` |

Full shortcut reference: [Keyboard Shortcuts](tastenkuerzel.md)
