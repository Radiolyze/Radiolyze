# Risk Management (Art. 9)

EU AI Act Article 9 requires a documented, iterative risk management system covering the entire lifecycle of a high-risk AI system. This page describes the risk management framework for Radiolyze and provides the FMEA table template.

---

## Regulatory Basis

| Regulation | Requirement |
|---|---|
| EU AI Act Art. 9 | Risk management system: identification, analysis, estimation, evaluation, mitigation |
| ISO 14971:2019 | International standard for medical device risk management |
| MDR 2017/745 | Post-market surveillance and risk requirements for medical devices |

Radiolyze is classified as a **high-risk AI system** under EU AI Act Annex III (medical AI used in clinical decision support).

---

## Risk Management Process

### 1. Scope

Risks covered:

- AI inference errors (incorrect impression or findings)
- ASR transcription errors (wrong dictation interpretation)
- Missing or incorrect prior study comparison
- Data integrity failures (corrupt DICOM, lost report)
- Unauthorised access to patient data (PHI breach)
- System unavailability (downtime during reporting session)
- Audit log gaps (incomplete traceability)
- User over-reliance on AI output

Risks explicitly out of scope for this document (addressed elsewhere):

- Clinical protocol design (handled by deploying institution)
- Network infrastructure security (handled by institution IT)
- Physical access controls (handled by institution)

### 2. Risk Estimation Criteria

**Severity (S):**

| Level | Description |
|---|---|
| 1 — Negligible | No patient impact; minor inconvenience |
| 2 — Minor | Delayed reporting; no direct patient harm |
| 3 — Moderate | Incorrect report reaches clinician; could influence treatment |
| 4 — Serious | Incorrect diagnosis acted upon; patient harm possible |
| 5 — Critical | Severe patient harm or death |

**Probability (P):**

| Level | Description |
|---|---|
| 1 — Remote | < 1 in 10,000 reports |
| 2 — Unlikely | 1 in 1,000–10,000 reports |
| 3 — Occasional | 1 in 100–1,000 reports |
| 4 — Likely | 1 in 10–100 reports |
| 5 — Frequent | > 1 in 10 reports |

**Risk Priority Number (RPN) = S × P**

| RPN | Action required |
|---|---|
| 1–4 | Accept; monitor |
| 5–9 | Mitigate or accept with documented rationale |
| 10–15 | Mitigate; verify effectiveness |
| 16–25 | Unacceptable; must reduce before deployment |

---

## FMEA Table

| ID | Failure Mode | Effect | S | Cause | P | RPN | Mitigation | Residual S | Residual P | Residual RPN |
|---|---|---|---|---|---|---|---|---|---|---|
| R-01 | AI impression contains incorrect laterality | Radiologist approves incorrect finding | 4 | Model hallucination; image orientation metadata error | 3 | 12 | QA warning on laterality terms; radiologist must review before approve | 4 | 1 | 4 |
| R-02 | AI impression misses critical finding (e.g. pneumothorax) | Finding omitted from signed report | 5 | Model limitation; low-confidence finding not surfaced | 2 | 10 | Radiologist reviews images independently; AI output is advisory only; warning admonition in UI | 5 | 1 | 5 |
| R-03 | ASR transcribes wrong organ name | Incorrect dictation in report | 3 | Acoustic similarity; background noise | 3 | 9 | Radiologist reviews transcript before saving; editable transcript field | 3 | 2 | 6 |
| R-04 | Wrong prior study loaded for comparison | Comparison with unrelated study | 3 | Worklist match by name/DOB ambiguity | 2 | 6 | UI displays patient name + DOB + study date for prior; radiologist confirms | 3 | 1 | 3 |
| R-05 | Report saved to wrong patient record | Wrong patient receives report | 5 | UI confusion; session switching | 1 | 5 | Patient banner always visible; sign-off dialog shows patient details | 5 | 1 | 5 |
| R-06 | PHI appears in application logs | Data breach; GDPR violation | 4 | Developer error; logging misconfiguration | 2 | 8 | Log sanitisation policy; no-PHI-in-logs linting; security audit | 4 | 1 | 4 |
| R-07 | Audit log gap (events missing) | Incomplete traceability; Art. 12 violation | 3 | Database failure; worker crash mid-job | 2 | 6 | Audit writes use database transactions; worker retry on failure; DB backup | 3 | 1 | 3 |
| R-08 | User accepts AI draft without review | Unreviewed report signed | 5 | Workflow pressure; over-trust in AI | 3 | 15 | Mandatory approval dialog with explicit confirmation; warning in UI; training | 5 | 2 | 10 |
| R-09 | System unavailable during urgent reporting | Delayed diagnosis | 3 | Docker service crash; infrastructure failure | 2 | 6 | Health check monitoring; runbook restart procedures; UPS recommendation | 3 | 1 | 3 |
| R-10 | Model update changes output characteristics | Unexpected report style or accuracy change | 3 | Uncontrolled model version change | 2 | 6 | Model version pinned in env; version recorded in audit log; staged rollout | 3 | 1 | 3 |

!!! note "Completing this table"
    The values above are indicative estimates for the reference implementation. Deploying organisations must conduct a formal FMEA with clinical input from radiologists and risk management experts familiar with the specific deployment context.

---

## Residual Risk

After applying all mitigations listed above, the highest residual RPN is **10** (R-08: user accepts AI draft without review).

**Acceptance rationale for R-08 residual risk:**  
A residual RPN of 10 is accepted because: (1) the approval dialog provides an explicit confirmation step, (2) radiologists bear professional responsibility for all signed reports under applicable medical law, and (3) the AI system is clearly designated as advisory. This is consistent with ISO 14971 ALARP (As Low As Reasonably Practicable) principle.

**Residual risks classified as unacceptable (RPN ≥ 16): None.**

---

## Mitigation Measures

### M-1: Mandatory Human Approval

Every AI output must pass through an explicit approval dialog before the report is finalised. The radiologist must click "Approve" — there is no auto-sign pathway.

Implementation: `src/components/Reporting/ApprovalDialog.tsx`

### M-2: QA Engine

Automated rule-based QA checks run on every report before sign-off. Current rules flag:

- Laterality inconsistencies (left/right)
- Missing required sections
- Placeholder text remaining in the report

QA warnings appear inline and cannot be silently dismissed.

Implementation: `backend/app/services/qa_service.py`

### M-3: Audit Trail

All inference, edit, and approval events are written to `audit_events` with model version, input hash, and timestamp. This provides post-hoc reviewability for every signed report.

Implementation: `backend/app/services/audit_service.py`

### M-4: UI Transparency

The AI panel always displays:
- Current model name and version
- Inference status (pending / completed / failed)
- Whether the impression was edited after generation

This prevents confusion about AI vs. radiologist-authored content.

### M-5: Log Sanitisation

All logging calls are reviewed to ensure no PHI (patient name, DOB, study ID beyond hashing) is written to application logs. The security hardening guide includes PHI-log audit steps.

Reference: [Security Hardening](../admin/security-hardening.md)

---

## Periodic Review

| Review trigger | Action |
|---|---|
| Model version change | Re-evaluate R-02, R-10; update FMEA |
| New QA rule added or removed | Re-evaluate R-01, R-03 |
| Incident or near-miss | Add to FMEA; adjust RPN; implement additional mitigation |
| Annual review | Full FMEA re-assessment with clinical input |
| Regulatory update | Map new requirements; update this document |

---

## ISO 14971 Alignment

| ISO 14971 Process Step | Radiolyze Implementation |
|---|---|
| Risk analysis | FMEA table (this document) |
| Risk evaluation | RPN threshold (≥ 16 = unacceptable) |
| Risk control | Mitigation measures M-1 through M-5 |
| Residual risk evaluation | Residual RPN table above |
| Risk-benefit analysis | Advisory-only positioning; ALARP rationale |
| Overall residual risk | Documented in this section |
| Risk management review | Periodic review schedule above |
| Production / post-production | Art. 72 post-market monitoring |

---

## Related

- [Compliance Checklist](checklist.md)
- [Evidence Overview](evidence-overview.md)
- [Annex IV Technical Documentation](annex-iv.md)
- [Audit Logging](audit-logging.md)
- [Post-Market Monitoring](../operations/observability.md)
