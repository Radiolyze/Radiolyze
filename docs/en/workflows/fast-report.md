# Fast Reporting Workflow

**Best for:** Routine single-series studies (chest X-ray, plain films, simple ultrasound)  
**Typical time:** 5–10 minutes from queue to signed report

---

## When to Use This Workflow

Use Fast Reporting when:

- The study has one or two image series (e.g., PA + lateral CXR)
- No systematic prior comparison is needed
- The clinical question is straightforward
- You are working through a worklist of similar cases

For CT/MR studies with multiple series or required prior comparison, use the [Complex Case Workflow](complex-case.md).

---

## Step-by-Step

### 1. Select from the Worklist

Click a study in the left sidebar worklist. Studies are shown with modality, date, and priority.

The viewer loads the study automatically. For a CXR, you typically see the PA projection first.

**Check:**
- Correct patient name and study date visible in the viewer header
- Image quality acceptable (not blurry, correct body part)

---

### 2. Review the Image

Take a systematic look before dictating:

1. **Orientation** — confirm PA vs. AP, lateral projection labelled correctly
2. **Technical quality** — rotation, inspiration, exposure
3. **Lung fields** — both lung fields visible, check for consolidation, effusion, pneumothorax
4. **Heart** — cardiac silhouette size, mediastinum width
5. **Bones** — ribs, clavicles, visible spine
6. **Soft tissues and tubes** — any visible lines or tubes

Use windowing presets if needed:

| Preset | Use |
|---|---|
| Chest / Lung | Lung parenchyma assessment |
| Bone | Rib or clavicle fracture |
| Soft Tissue | Mediastinum, pleura |

---

### 3. Dictate Findings

Click the **microphone button** in the Findings panel or press `Ctrl + M`.

Speak your findings by anatomical region:

> *"Lungs: No consolidation. No pleural effusion. No pneumothorax. Heart: Normal in size. Mediastinum: No widening. Bones: No acute fracture visible. Soft tissues: Unremarkable."*

Stop dictation with `Ctrl + M`. Review and correct the transcription text.

!!! tip "Tips for better ASR accuracy"
    - Speak at a normal pace — not too fast
    - Use full words instead of abbreviations ("bilateral" not "bil.")
    - Dictate section by section with a brief pause between regions
    - Correct errors immediately rather than continuing

**Alternative:** Type findings directly into the text field.

---

### 4. Generate AI Impression

Click **"Generate Impression"** in the Impression panel.

Wait 10–30 seconds (longer on first call after startup). A draft impression appears.

**Typical AI output for a normal CXR:**
> *"No active cardiopulmonary process. The cardiac silhouette is within normal limits. The lungs are clear bilaterally. No pleural effusion or pneumothorax is identified."*

---

### 5. Review the AI Draft

Read the impression carefully:

- Does it match what you dictated and what you see?
- Are findings correctly sided (left/right)?
- Are any findings added that you did not see?
- Is the severity accurately characterised?

Edit as needed. Common corrections:

| Issue | Action |
|---|---|
| Wrong laterality | Correct directly in the text |
| AI added a finding you didn't see | Delete it |
| Severity overstated | Downgrade the wording |
| Missing clinical context | Add manually (e.g., "in the context of post-operative day 1…") |
| Non-standard terminology | Rewrite in your preferred style |

---

### 6. Check QA

The QA panel (below the impression) runs automatic checks:

- Findings not empty ✓
- Impression not empty ✓
- Laterality terms consistent ✓

Resolve any red warnings before proceeding.

---

### 7. Approve the Report

Click **"Approve"** — or press `Ctrl + Enter`.

The approval dialog shows the final report text. Confirm. The report is saved and logged with your identity and the AI model version.

---

## Tips for Speed

- **Use voice dictation** — faster than typing for most radiologists after the first few sessions
- **Use windowing presets** — press `P`, `M`, `Z` instead of toolbar clicks
- **Approve with keyboard** — `Ctrl + Enter` skips the mouse
- **Batch similar cases** — CXRs after CXRs; the AI stays "warm" between calls
- **Don't over-dictate** — normal findings need minimal description; focus your dictation on the abnormal

---

## If Something Goes Wrong

| Problem | Solution |
|---|---|
| ASR not starting | Check microphone permission; see [Troubleshooting](../doctors/troubleshooting.md) |
| AI gives no output | Write impression manually; report to administrator |
| Report not saving | Check network; `Ctrl + S` to save draft first |
| Image not loading | Reload the page; contact administrator if persists |
