# AI in Radiolyze — What Every Radiologist Should Know

This page explains how the AI works, what it can and cannot do, and how to work with it safely.
No technical background is required.

---

## What the AI Does

Radiolyze uses an AI model called **MedGemma** — a system trained on millions of medical images and reports. When you request an AI impression, two things happen:

1. **Image analysis** — a sample of the DICOM images is converted to photographs and sent to the AI.
2. **Text generation** — the AI reads your dictated findings and the images, then writes a draft impression in natural language.

The AI does **not** access the hospital information system, the patient's history, previous laboratory results, or clinical notes. It sees only what you have written in the Findings field and the image sample.

---

## What the AI Outputs

| Output | What it is | Where it appears |
|---|---|---|
| **Draft impression** | One or more paragraphs summarising the study findings | Impression panel (right column) |
| **Confidence level** | How certain the AI is (displayed as percentage or label) | Below the impression text |
| **Model version** | Which AI model generated the output | Hover over the confidence indicator |

---

## Understanding Confidence Levels

The confidence indicator reflects the AI's own uncertainty estimate — **not** clinical accuracy.

| Level | Meaning | What to do |
|---|---|---|
| High (>80%) | AI is internally consistent in its output | Still review carefully — high confidence does not mean correct |
| Medium (50–80%) | AI found the task moderately clear | Review with extra attention |
| Low (<50%) | AI was uncertain — output may be incomplete | Treat draft as a starting point only; rewrite as needed |

!!! warning "Confidence does not equal correctness"
    The AI can be 95% confident and still wrong. The confidence score reflects internal model certainty, not diagnostic accuracy for your specific patient.

---

## What the AI Can Do Well

- Draft routine findings for common presentations (pneumonia, effusion, cardiomegaly, normal CXR)
- Structure an impression in standard radiological language
- Suggest measurement comparisons when prior studies are referenced in findings
- Produce a grammatically correct, readable report draft quickly

---

## What the AI Cannot Do

| Limitation | Why it matters |
|---|---|
| **No access to patient history** | AI does not know about prior diagnoses, allergies, or clinical question |
| **No correlation with lab values** | AI cannot interpret imaging in the context of elevated troponin, tumour markers, etc. |
| **Limited rare-finding performance** | Uncommon pathologies may be missed or misnamed |
| **No true 3D understanding** | AI receives flat image samples, not the full volumetric dataset |
| **Language is English by default** | Multilingual output quality is reduced |
| **Population bias** | Model was trained on specific datasets; performance varies by patient demographics |

---

## How to Use AI Suggestions Safely

### Always read the full draft

Never approve an impression that you have not read word by word. AI text can sound authoritative while being incorrect.

### Compare findings to images

For every finding mentioned in the AI draft, locate it in the images. If you cannot see it, remove it from the impression.

### Pay attention to laterality

Left/right errors are a known AI failure mode. Verify that every side mentioned is correct.

### Correct, do not just append

If the AI draft contains an error, fix it — do not add a correction note at the end. The final signed report must read as your own professional statement.

### Use clinical context the AI lacks

Add information the AI cannot know: "In the context of new fever and raised CRP…", "Compared with the post-operative baseline…", "The referring clinician's question was…"

---

## Documenting Disagreements

When you correct or reject an AI suggestion:

- Simply edit or clear the impression field.
- Your changes are automatically logged in the audit trail.
- No additional action is required — the audit trail records both the AI draft and your final approved text.

This documentation supports compliance with EU AI Act Article 14 (human oversight).

---

## Who Is Responsible for the Report?

**You are.** The radiologist who clicks "Approve" is responsible for the entire content of the signed report. The AI is a tool that assists with drafting; it cannot carry clinical or legal responsibility.

This principle is reflected in Radiolyze's design:

- Approval is always manual and requires your explicit action.
- The AI output is labelled as a draft.
- The audit trail records your identity, the timestamp, and the AI model version.

---

## What to Do When AI Output Is Systematically Wrong

If you notice the AI consistently making the same type of error on your institution's studies:

1. Document the pattern (which type of error, on which modality/presentation).
2. Report it to your administrator and the Radiolyze project via a [GitHub issue](https://github.com/radiolyze/radiolyze/issues).
3. In the meantime, treat AI output for that pattern as unreliable and rely on manual reporting.

Systematic issues are addressed by prompt adjustments or model updates — not by ignoring individual errors.

---

## Quick Reference

| Situation | Do this |
|---|---|
| AI draft looks correct | Read every line, then approve |
| AI draft has one error | Correct the specific error, then approve |
| AI draft is completely wrong | Clear the field, write impression manually |
| AI gives no output | Check with administrator; report manually |
| Confidence is low | Treat as starting point; verify every finding |
| Finding not visible in images | Remove from impression |
| Laterality seems wrong | Verify carefully in images before keeping |
