# Annex IV Technical Documentation (Draft)

This file follows the structure of Annex IV (EU AI Act) for high-risk systems.
It describes the current state of the technical documentation and highlights
gaps that must be closed before a conformity assessment.

## 1. System Identification

- Product name: Radiolyze Radiology Reporting
- Provider: (TBD organisation/legal entity)
- Version: v0.1.x (repo state)
- Deployment: On-prem (Docker Compose), optional GPU profile
- Contact: (TBD security/compliance contact)

## 2. Intended Purpose

- Assistance system for radiological findings and reporting.
- Supports impression / QA / ASR, but does not perform autonomous diagnosis.
- User groups: radiologists, QA staff, admins (technical operations).
- Deployment environment: hospitals/radiology departments, on-prem, no external data egress.

## 3. System Overview

Components and data flow are documented in:

- Architecture: `docs/architecture/overview.md`
- Data flow: `docs/architecture/data-flow.md`
- Backend: `docs/architecture/backend.md`
- Frontend: `docs/architecture/frontend.md`

## 4. System Design & Software Architecture

- Frontend: React + TypeScript (viewer, reporting, QA, templates, guidelines).
- Orchestrator: FastAPI (report workflow, QA, ASR, inference queue).
- Queue/Worker: RQ + Redis (inference jobs).
- DICOM: Orthanc as mini-PACS and DICOMweb provider.
- Storage: Postgres for reports, QA, and audit events.

## 5. Data Governance

- DICOM data flow via Orthanc DICOMweb.
- No PHI in client logs (policy, see security documentation).
- Audit logs kept minimal: hashes instead of raw data.
- Optional: DICOM anonymisation for export/training (policy TBD).

## 6. Model Information

- Inference model: MedGemma (multimodal), configurable via ENV.
- ASR: MedASR (local/GPU cluster).
- Model versions are recorded in audit events (queue/worker).
- Model cards and training data: referenced in product documentation (TBD).

## 7. Performance Metrics & Validation

Planned/to-be-collected metrics:

- QA pass/warn/fail rate
- Inference confidence distribution
- Turnaround time (queue -> result)
- Error classes (ASR, inference, QA)

Status:

- Baseline metrics are defined; measurement and reporting is planned.

## 8. Risk Analysis & Mitigation (Art. 9)

Examples of identified risks:

- Incorrect AI output is treated as final.
- Missing or incorrect prior study selection.
- Data leakage / PHI in logs.

Mitigation:

- Human oversight (approval dialog, editability).
- UI transparency (status, model version, QA checks).
- Audit logging with minimal data fields.

## 9. Human Oversight (Art. 14)

- Approval dialog for report finalisation.
- Every AI output is editable; the UI displays status and QA results.
- Fallbacks on inference/ASR errors (workflow is never blocked).

## 10. Logging & Traceability (Art. 12)

- Audit event schema: `docs/compliance/audit-logging.md`
- Events: report create/open/approve, ASR, QA, inference queue/worker.
- Metadata: model version, input hash, output summary (truncated).

## 11. Cybersecurity & Robustness (Art. 15)

- TLS termination for all endpoints (reverse proxy).
- AuthN/AuthZ via JWT + RBAC (radiologist, QA, admin).
- Network segmentation (DB/Redis/Orthanc not publicly exposed).
- Rate limiting for uploads/inference.
- Security policy: `docs/operations/security.md`

## 12. Post-Market Monitoring (Art. 72)

- Drift monitoring (planned): model performance, QA trends.
- Incident process (planned): severity classification, emergency patches, audit trail.

## 13. Change & Release Management

- Model versioning (ENV + audit events).
- Release notes + approval gate for production deployments.
- Update process with hash verification (see internet usage policy).

## 14. Annexes / Evidence Artefacts

- Audit log export (JSON)
- QA reports (CSV/JSON)
- Model version history
- Security concept (TLS, auth, RBAC)
- Test reports (unit/integration, smoke tests)

## 15. Conformity Assessment Status

This section documents the current implementation status of all items required
for a conformity assessment. Items marked **Deployer action required** must be
completed by the deploying organisation before going live.

### 15.1 Risk Analysis (FMEA / ISO 14971)

**Status: ✅ Framework complete — deployer clinical sign-off required**

A full FMEA covering 10 failure modes has been documented in
[`risk-management.md`](risk-management.md). The table below summarises the
top risks and their residual risk priority numbers (RPN):

| ID | Failure Mode | Initial RPN | Mitigation | Residual RPN |
|----|---|---|---|---|
| R-01 | AI impression with incorrect laterality | 12 | QA laterality check; radiologist review | 4 |
| R-02 | AI misses critical finding (e.g. pneumothorax) | 10 | AI advisory only; UI warning admonition | 5 |
| R-03 | ASR wrong organ name | 9 | Editable transcript; radiologist review | 6 |
| R-04 | Wrong prior study loaded | 6 | UI shows patient/DOB/date; radiologist confirms | 3 |
| R-05 | Report saved to wrong patient | 5 | Persistent patient banner; sign-off dialog | 5 |
| R-06 | PHI in application logs | 8 | Log sanitisation policy; security audit | 4 |
| R-07 | Audit log gap | 6 | DB transaction writes; worker retry; backup | 3 |
| R-08 | User accepts AI draft without review | 15 | Mandatory approval dialog; training requirement | 10 |
| R-09 | System unavailable during urgent reporting | 6 | Health check monitoring; restart runbook | 3 |
| R-10 | Model update changes output characteristics | 6 | Model version pinned in ENV; staged rollout | 3 |

Highest residual RPN: **10** (R-08). Accepted under ALARP — see
[`risk-management.md`](risk-management.md#residual-risk) for rationale.

!!! warning "Deployer action required"
    The FMEA values above are indicative estimates for the reference
    implementation. The deploying organisation must conduct a formal FMEA
    review with clinical and risk management experts, obtain sign-off, and
    record the residual risk acceptance decision before a conformity assessment.

### 15.2 Data Governance

**Status: ✅ Policy framework complete — organisation-specific entries required**

Data protection and governance is documented in [`datenschutz.md`](datenschutz.md),
covering:

- **Data categories:** DICOM images, patient demographics, radiology reports,
  audit event metadata, ASR audio (RAM only, not persisted), application logs
  (pseudonymised).
- **Legal basis:** GDPR Art. 9(2)(h) (healthcare management) or Art. 9(2)(j)
  (research); deployer must confirm with DPO.
- **DICOM anonymisation:** Policy and tooling guidance (Orthanc, pydicom, CTP)
  documented; deployer must implement for export/training workflows.
- **Training data provenance:** Radiolyze performs no pretraining. MedGemma
  upstream training data is documented in [`model-card-medgemma.md`](model-card-medgemma.md).
- **Retention policy:** Audit events retained for the AI system lifecycle
  (EU AI Act Art. 12); clinical records per institution policy.
- **PHI exclusion from logs:** Policy enforced; no patient name, DOB, or raw
  study data written to application logs.

!!! warning "Deployer action required"
    Complete the GDPR Art. 30 Record of Processing Activities template in
    [`datenschutz.md`](datenschutz.md#gdpr-art-30--record-of-processing-activities-template)
    with organisation-specific controller details, DPO contact, and legal basis
    confirmation. Establish Data Processing Agreements with sub-processors.

### 15.3 Model Cards

**Status: ✅ Complete**

A full model card for MedGemma (the primary inference model) is available at
[`model-card-medgemma.md`](model-card-medgemma.md). It includes:

- Model identification (family, variants, serving framework)
- Intended and out-of-scope use cases
- Upstream training data (MIMIC-CXR, MedQA, upstream Gemma 2 pretraining)
- Evaluation metrics (CheXpert AUC, MIMIC-CXR RadGraph F1, VQA-RAD accuracy)
- Known limitations and biases (language, population, modality, hallucinations)
- Inference configuration (temperature, max tokens, guided JSON)
- Audit trail integration (model version, input hash per inference job)
- Versioning and update process

### 15.4 KPI / Drift Dashboards

**Status: ⚠️ Backend infrastructure complete — visualisation is a deployer task**

The following monitoring infrastructure is implemented and operational:

| Component | Implementation | Status |
|---|---|---|
| `DriftSnapshot` DB model | `backend/app/models.py` | ✅ Active |
| Drift scheduler | `backend/app/main.py` (APScheduler) | ✅ Active (default: 24 h interval) |
| Drift API endpoint | `GET /api/v1/monitoring/drift` | ✅ Active |
| QA metrics endpoint | `GET /api/v1/monitoring/qa-stats` | ✅ Active |
| Health check endpoint | `GET /api/v1/health` | ✅ Active |

Drift snapshots capture QA pass/warn/fail rates and inference confidence
distributions. Deployers can consume these endpoints via any observability
tool (e.g. Grafana, Prometheus exporter, custom dashboard).

!!! warning "Deployer action required"
    Configure a monitoring dashboard consuming `/api/v1/monitoring/drift` and
    `/api/v1/monitoring/qa-stats`. Set alert thresholds for drift detection.
    Enable `DRIFT_SCHEDULE_HOURS` (default: 24) via environment variable.

### 15.5 RBAC Implementation

**Status: ✅ Infrastructure complete and enforced on critical endpoints**

Authentication and authorisation is implemented as follows:

| Component | Details | Status |
|---|---|---|
| Auth provider | JWT (HS256) via `python-jose` | ✅ Active |
| Password hashing | bcrypt ≥ 4.1.2 | ✅ Active |
| Roles defined | `radiologist`, `admin` (extensible) | ✅ Active |
| Role enforcement | `require_role()` dependency in `backend/app/deps.py` | ✅ Active |
| Inference endpoints | `POST /inference/queue`, `/localize`, `/volume`, `/comparison` | ✅ Protected |
| Report endpoints | `GET`, `PATCH /reports/*`, `POST /reports/create`, `POST /reports/*/finalize` | ✅ Protected |
| Annotation endpoints | All CRUD operations | ✅ Protected |
| Audit log write | `POST /audit-log` | ✅ Protected |
| Segmentation jobs | `POST /segmentation/jobs` | ✅ Protected |
| Admin-only endpoints | Guidelines CRUD, Prompt updates, QA rules CRUD, Training export | ✅ Protected |

!!! warning "Deployer action required"
    - Change the default admin password before production deployment (enforced
      at startup in production mode).
    - Set `JWT_SECRET_KEY` to a cryptographically random value of ≥ 32 characters.
    - Set `AUTH_REQUIRED=true` in production (this is the default).
    - Conduct a penetration test to verify auth enforcement end-to-end.
