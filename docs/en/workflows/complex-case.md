# Complex Case Workflow

**Best for:** CT and MR studies with multiple series, lesion measurement, and prior study comparison  
**Typical time:** 15–30 minutes depending on study complexity

---

## When to Use This Workflow

Use the Complex Case Workflow when:

- The study has multiple series (axial, coronal, sagittal reconstructions)
- Comparison with prior examinations is needed (oncology follow-up, post-treatment assessment)
- Lesion measurement or change documentation is required
- Clinical guidelines need to be referenced (RECIST, RADS criteria)

---

## Step-by-Step

### 1. Select the Study

Click the study in the worklist sidebar. For CT studies, the axial series typically loads first.

**Before starting, confirm:**
- Correct patient and study date
- Expected modality and body region loaded
- All requested series are available (if a series is missing, contact the technologist)

---

### 2. Navigate the Series

Open the series list in the left sidebar to see all available series:

| Typical CT series | Purpose |
|---|---|
| Axial | Primary diagnostic view |
| Coronal | Organ relationships, diaphragm, vasculature |
| Sagittal | Spine, retroperitoneum |
| Axial + contrast | Phase-specific enhancement |
| MPR (auto-generated) | Reformatted reconstructions |

Click any series to load it. Switch between series with the series list — images load progressively.

**Use windowing presets** appropriate to the region:

| Region | Preset |
|---|---|
| Chest CT — lung parenchyma | Lung |
| Chest CT — mediastinum | Soft Tissue |
| Abdomen | Abdomen |
| Bone | Bone |
| Brain | Brain |

---

### 3. Activate MPR View (if available)

For volumetric CT or MR, activate the MPR (Multi-Planar Reconstruction) viewer:

- Click the **MPR** button in the viewer toolbar
- Three panels appear: Axial · Sagittal · Coronal
- Moving the crosshair in any panel updates the others
- Press `1`, `2`, or `3` to maximise a single plane; `Esc` to return to the three-panel view
- Toggle MIP (Maximum Intensity Projection) with `M` for vascular studies

---

### 4. Measure Lesions

Press `M` to activate the measurement tool.

Draw a measurement line across the lesion in the axial plane. For RECIST measurements:
- Measure the **longest diameter** of the lesion
- Measure the **perpendicular diameter** in the same plane
- Record measurements in the Findings text

The measurement tool shows the distance in millimetres and saves the annotation to the study.

---

### 5. Load Prior Studies for Comparison

In the **Prior Studies panel** (bottom of the left sidebar), previously reported studies for the same patient appear automatically, sorted by date.

Click a prior study to open it in **split view**:

- Current study appears on the left
- Prior study appears on the right
- Both viewers scroll synchronously (enable/disable via the sync button)

**Comparing measurements:**
1. Activate the measurement tool (`M`) in the current study
2. Measure the current lesion size
3. In the prior study, measure the same lesion
4. Note the change in the Findings dictation

**If prior studies are not appearing:**
- The patient ID must match exactly between studies in Orthanc
- Ask your administrator to verify that prior studies were sent to the same PACS instance

---

### 6. Dictate Findings by System / Region

Open the Findings panel and dictate systematically. For a chest CT:

> *"Lungs: 1.2 cm nodule in the right lower lobe (series 3, image 45), previously 0.9 cm on 2025-03-15, representing an increase of 3 mm (33%). No new nodules. No consolidation. Bilateral pleural effusion, right greater than left, small in volume. Heart and pericardium: normal cardiac size. Mediastinum: no lymphadenopathy. Bones: no lytic or sclerotic lesions."*

Structure findings to:
- Describe each finding with location, size, and density/signal characteristics
- State comparison values when priors are available ("previously X, now Y")
- Note absence of expected findings ("no lymphadenopathy")

---

### 7. Request AI Impression

Click **"Generate Impression"** in the Impression panel.

For complex cases, the AI draft is a starting point. It typically:
- Summarises the key findings you dictated
- May not correctly interpret comparison language ("increased from" phrasing)
- Does not know the clinical question or treatment context

**Always edit the AI draft to:**
- Confirm or correct the primary diagnosis
- Add clinical context not present in imaging alone
- Use your institution's preferred vocabulary for follow-up recommendations

---

### 8. Reference Guidelines (if configured)

If guidelines are configured on your system, the Guidelines panel (right column) shows applicable criteria:

- RECIST 1.1 for tumour measurement
- Fleischner Society for pulmonary nodules
- TIRADS, PIRADS, BIRADS for organ-specific structured reporting

Guidelines display automatically based on the study type and findings — they are informational only and do not change the report automatically.

---

### 9. QA Check

The QA panel runs checks specific to complex reporting:

- Measurements present when a nodule/lesion is mentioned
- Comparison language present when prior study is loaded
- Impression matches finding count

Resolve any warnings before approval.

---

### 10. Approve

Click **"Approve"** or press `Ctrl + Enter`. Review the full report in the approval dialog before confirming.

---

## Tips for Complex Cases

- **Navigate systematically** — use a mental checklist appropriate to the modality before dictating
- **Measure first, dictate second** — complete all measurements before dictating to have numbers ready
- **Load the prior before dictating** — comparative language in your findings helps the AI draft the impression correctly
- **Zoom in on lesions** — use `Z` mode for detailed assessment; `R` to reset
- **Use MPR for lesion characterisation** — a lesion measured only on axial may have a different true longest diameter on coronal or sagittal

---

## Modality-Specific Notes

### CT Chest
- Use both lung and mediastinal windowing; document findings in both windows
- Pulmonary artery assessment: activate CT pulmonary angiography (CTPA) preset if available

### CT Abdomen/Pelvis
- Systematic approach: liver → biliary → pancreas → spleen → kidneys → adrenals → vessels → retroperitoneum → bowel → pelvis → bones
- Note contrast phase for each series (unenhanced, arterial, portal venous, delayed)

### MR Brain
- Review DWI (acute stroke), FLAIR (white matter, cortex), T1 (anatomy, enhancement), T2 (oedema, mass effect)
- Note laterality and hemisphere for every finding
