# Batch Reporting Workflow

**Best for:** Processing a high-volume queue of studies back-to-back  
**Typical time:** 2–5 minutes per case

---

## When to Use This Workflow

Use Batch Reporting when:

- You have a queue of multiple studies to work through in a session
- Most studies are routine (similar type, limited complexity)
- You want to minimise time between cases
- AI drafts are already available for studies in the queue

---

## Accessing the Batch Dashboard

Navigate to `/batch` (click **Batch** in the top navigation bar). The batch dashboard shows:

- All studies in the reporting queue with status, priority, and modality
- Bulk actions for selecting multiple studies
- Analytics panel showing throughput and queue length

---

## Step-by-Step

### 1. Open the Queue

The queue lists pending studies. Columns show:

| Column | Meaning |
|---|---|
| Priority | Urgent / Routine |
| Modality | CXR, CT, MR, US… |
| Patient / Study Date | Identification |
| Status | Pending / In Progress / Complete |
| Waiting time | How long the study has been in the queue |

Sort by priority or waiting time to work through the most urgent cases first.

---

### 2. Open a Study

Click a study row to open it in the report workspace. The DICOM viewer and reporting panels load.

In batch mode, the system attempts to pre-generate an AI impression before you open the study. If pre-generation is complete, the impression draft is already waiting.

---

### 3. Quick Review

Efficiently review the AI draft:

1. **Scan the images** — scroll quickly through the series; use windowing presets.
2. **Read the AI impression** — check for obvious errors, wrong laterality, or missing key findings.
3. **Correct if needed** — edit the impression text directly.
4. **Check QA** — resolve any warnings.

For routine normal studies, this step can take under 2 minutes with a pre-generated AI draft.

!!! warning "Speed does not reduce responsibility"
    Even in batch mode, every report must be reviewed. Do not approve a report you have not read. The AI draft can be wrong.

---

### 4. Approve

Press `Ctrl + Enter` to open the approval dialog, then confirm.

The system automatically loads the **next study** from the queue.

---

### 5. Continue Through the Queue

Work through studies sequentially. The queue dashboard updates in real time as studies are completed.

**Keyboard-first workflow for speed:**

| Action | Shortcut |
|---|---|
| Toggle microphone | `Ctrl + M` |
| Save draft | `Ctrl + S` |
| Approve and advance | `Ctrl + Enter` |

---

## Bulk Actions

From the batch dashboard (not the report workspace), you can:

- **Select multiple studies** — checkbox at the left of each row
- **Bulk assign** — assign a set of studies to a radiologist
- **Bulk prioritise** — change priority for a group
- **Export queue** — download the current queue as CSV for scheduling

---

## Tips for Efficient Batch Reporting

- **Work modality by modality** — CXRs together, then CT series; context switching reduces speed
- **Pre-warm the AI** — the first AI call after startup is slower; open one study before your main session
- **Use `Ctrl + Enter` throughout** — removes the need to move to the mouse between cases
- **Keep the QA panel visible** — spot patterns in QA warnings across similar studies
- **Flag complex cases** — if a case needs more time, use the "Hold" action instead of rushing the review

---

## Analytics

The batch dashboard includes an analytics panel showing:

- Reports completed per hour/day
- Average time per case
- Queue length trend
- AI draft acceptance rate (cases approved without edits vs. cases modified)

Use the acceptance rate to identify case types where AI drafts need more correction — these may benefit from prompt tuning.

---

## Related

- [Fast Reporting Workflow](fast-report.md) — for individual cases
- [Complex Case Workflow](complex-case.md) — when a queued case turns out to be complex
- [Keyboard Shortcuts](../doctors/tastenkuerzel.md) — full shortcut reference
