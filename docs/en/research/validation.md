# Validation & Benchmarking Guide

How to measure, document, and report the performance of the AI system in your Radiolyze deployment. Required for EU AI Act Art. 9 and Art. 11 compliance.

---

## Why Validate Locally

Upstream benchmark results (CheXpert AUC, MIMIC-CXR RadGraph F1) are measured on standardised English-language datasets from US hospitals. Your deployment may differ in:

- Scanner manufacturer and model (different image quality characteristics)
- Patient population demographics
- Reporting language (German, French, etc.)
- Institution-specific reporting conventions
- DICOM frame selection and windowing settings

**Local validation is not optional for clinical deployment.** It provides the evidence required under EU AI Act Art. 9 (risk management) and Art. 11 (technical documentation).

---

## Validation Data Requirements

| Requirement | Guidance |
|---|---|
| Sample size | ≥ 100 cases per modality (≥ 200 for primary modality) |
| Gold standard | Radiologist-authored reports (not AI-assisted); ideally double-read |
| Case selection | Random sample from routine queue; include edge cases |
| Time period | Prospective preferred; retrospective acceptable if no selection bias |
| Data split | Validation set must be separate from any training/fine-tuning data |
| Anonymisation | Apply DICOM de-identification before any external processing |

---

## Step-by-Step Validation Process

### 1. Prepare the Dataset

```bash
# Export a set of study IDs for validation
docker compose exec postgres psql -U postgres radiolyze \
  -c "SELECT study_id FROM reports WHERE modality = 'CXR' 
      AND created_at BETWEEN '2026-01-01' AND '2026-03-31'
      ORDER BY RANDOM() LIMIT 200;" \
  -t -A > validation_study_ids.txt
```

Anonymise DICOM data if you will share it outside the clinical environment:

```bash
# Use Orthanc anonymisation (replace STUDY_ID with actual ID)
curl -s -u orthanc:orthanc \
  -X POST http://localhost:8042/studies/STUDY_ID/anonymize \
  -H "Content-Type: application/json" \
  -d '{"Remove": ["PatientName", "PatientBirthDate"]}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['ID'])"
```

### 2. Run Batch Inference

Use the training data export endpoint to run inference on the validation set:

```bash
# Trigger inference for all studies in the validation set
while read STUDY_ID; do
  curl -s -X POST http://localhost:8000/api/v1/inference/queue \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"study_id\": \"$STUDY_ID\", \"validation\": true}"
done < validation_study_ids.txt

# Monitor progress
watch -n 5 'curl -s http://localhost:8000/api/v1/monitoring/drift | python3 -m json.tool'
```

### 3. Export Results

```bash
# Export inference results with gold standard reports
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/training/export?format=json&include_inference=true" \
  > validation_results.json
```

### 4. Compute NLP Metrics

Install the evaluation dependencies:

```bash
pip install evaluate rouge-score bert-score
```

Example evaluation script:

```python
import json
import evaluate

with open("validation_results.json") as f:
    data = json.load(f)

references = [case["gold_impression"] for case in data["cases"]]
predictions = [case["ai_impression"] for case in data["cases"]]

# ROUGE scores (lexical overlap)
rouge = evaluate.load("rouge")
rouge_results = rouge.compute(predictions=predictions, references=references)
print("ROUGE-1:", rouge_results["rouge1"])
print("ROUGE-2:", rouge_results["rouge2"])
print("ROUGE-L:", rouge_results["rougeL"])

# BERTScore (semantic similarity)
bertscore = evaluate.load("bertscore")
bert_results = bertscore.compute(
    predictions=predictions,
    references=references,
    lang="en"  # or "de" for German
)
print("BERTScore F1 (mean):", sum(bert_results["f1"]) / len(bert_results["f1"]))
```

### 5. Clinical Quality Assessment

NLP metrics alone are insufficient for clinical validation. Additionally collect:

| Metric | How to measure |
|---|---|
| **Clinical accuracy rate** | Radiologist review: was the impression clinically correct? (Yes/No/Partially) |
| **Critical finding detection rate** | Of studies with critical findings, what % did the AI identify? |
| **False positive rate** | How often did AI generate findings not present in the image? |
| **Laterality error rate** | Left/right errors per 100 reports |
| **QA pass rate** | % of AI-generated impressions that passed QA without modification |
| **Radiologist acceptance rate** | % of AI impressions approved without edit |
| **Average edit distance** | Character-level difference between AI impression and final signed report |

### 6. Subgroup Analysis

Analyse performance across subgroups to detect bias:

| Subgroup | Why it matters |
|---|---|
| Modality (CXR, CT, MR) | Model performance varies by modality |
| Age group (< 18, 18–65, > 65) | Paediatric and geriatric presentations differ |
| Finding category (normal vs. abnormal) | Check false positive and false negative rates separately |
| Scanner manufacturer | Image quality and DICOM formatting vary |
| Study urgency (urgent vs. routine) | AI must not under-perform on urgent cases |

---

## NLP Metrics Reference

| Metric | What it measures | Typical range | Good threshold |
|---|---|---|---|
| ROUGE-1 | Unigram recall/precision | 0–1 | > 0.40 |
| ROUGE-2 | Bigram recall/precision | 0–1 | > 0.20 |
| ROUGE-L | Longest common subsequence | 0–1 | > 0.35 |
| BERTScore F1 | Semantic similarity (contextual embeddings) | 0–1 | > 0.85 |
| RadGraph F1 | Entity-relation graph overlap (radiology-specific) | 0–1 | > 0.35 |

**RadGraph F1** (used in MIMIC-CXR benchmarks) is the most rigorous radiology-specific metric because it evaluates clinical entity extraction and relationships, not just surface text overlap. Requires the `radgraph` library (Jain et al., 2021).

---

## Compliance Connection

Validation results feed directly into compliance documentation:

| Compliance requirement | Validation evidence |
|---|---|
| EU AI Act Art. 9 (Risk Management) | Validation results quantify residual risk R-02 (AI misses critical finding) |
| EU AI Act Art. 11 (Technical Docs) | Validation report = Annex IV § 7 (Performance Metrics & Validation) |
| EU AI Act Art. 72 (Post-Market Monitoring) | Baseline metrics for drift detection — compare ongoing QA rates to validation baseline |
| ISO 14971 Risk Management | Clinical accuracy rate informs probability estimates in FMEA |

Store validation results in the evidence package:

```bash
# Add to evidence package
cp validation_results.json compliance-evidence-$(date +%Y%m%d)/
cp validation_report.pdf compliance-evidence-$(date +%Y%m%d)/
```

---

## Ongoing Monitoring

After go-live, track these metrics continuously via the drift endpoint:

```bash
curl http://localhost:8000/api/v1/monitoring/drift
```

Response includes:
- `qa_pass_rate`: % of reports passing QA (baseline from validation)
- `ai_acceptance_rate`: % approved without edit (higher = radiologists trust the AI)
- `inference_error_rate`: % of inference calls that failed
- `avg_inference_latency_ms`: performance metric

**Alert thresholds (recommended):**

| Metric | Alert threshold |
|---|---|
| QA pass rate drop | > 5 pp below validation baseline |
| AI acceptance rate drop | > 10 pp below validation baseline |
| Inference error rate | > 5% |
| Inference latency | > 2× validation baseline |

If drift is detected, re-run the validation process and review audit logs for the affected period.

---

## Reporting Validation Results

Minimum content of a validation report for regulatory purposes:

1. **System under test**: model version, inference config, vLLM version, date
2. **Dataset**: study count, modality breakdown, date range, anonymisation method
3. **Methodology**: gold standard creation, reviewer credentials, blinding approach
4. **Results**: NLP metrics table + clinical quality table + subgroup breakdown
5. **Comparison to upstream benchmarks**: how local results compare to published MedGemma benchmarks
6. **Limitations**: known gaps, excluded cases, population differences
7. **Conclusion**: acceptable for clinical deployment? Conditions / monitoring requirements?
8. **Sign-off**: clinical lead + compliance officer + date

---

## Related

- [MedGemma Deep Dive](medgemma.md) — upstream benchmark details
- [Model Switching](model-switching.md) — how to benchmark a new model after switching
- [Risk Management](../compliance/risk-management.md) — how validation feeds into FMEA
- [Evidence Overview](../compliance/evidence-overview.md) — where to store validation results
- [Observability](../operations/observability.md) — ongoing monitoring setup
