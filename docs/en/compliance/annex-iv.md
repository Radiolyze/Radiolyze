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

## 15. Open Items (TODO)

- Complete risk analysis (FMEA/ISO 14971).
- Data governance documentation (anonymisation/training).
- Complete model cards including training data sources.
- KPI/drift dashboards + monitoring.
- RBAC implementation and auth provider selection.
