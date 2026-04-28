# Data Protection & Privacy (GDPR / Art. 10)

This page documents Radiolyze's approach to personal data protection under GDPR and EU AI Act Article 10 (data governance requirements for high-risk AI systems).

---

## Regulatory Basis

| Regulation | Requirement |
|---|---|
| GDPR Art. 5 | Data minimisation, purpose limitation, storage limitation |
| GDPR Art. 9 | Special category data (health data) — explicit legal basis required |
| GDPR Art. 30 | Record of processing activities (controller obligation) |
| GDPR Art. 32 | Technical and organisational measures (TOMs) |
| EU AI Act Art. 10 | Data governance for training, validation, testing data |
| EU AI Act Art. 10(5) | Special category health data in training — strict conditions |

!!! warning "Deployer responsibility"
    Radiolyze is a software system. The deploying healthcare organisation is the **data controller** under GDPR. This document describes the system's built-in privacy controls; the deployer must complete the organisation-specific sections (legal basis, DPO contact, Art. 30 entries) before going live.

---

## Categories of Personal Data Processed

| Data Category | GDPR Classification | Where Processed | Retention |
|---|---|---|---|
| DICOM image data (radiological images) | Special category (health) Art. 9 | Orthanc PACS | Per clinical policy |
| Patient demographics (name, DOB, MRN) | Personal data + health data | Orthanc + report DB | Per clinical policy |
| Radiology reports (findings, impression) | Special category (health) Art. 9 | PostgreSQL | Per clinical policy |
| Audit event metadata | Personal data (actor_id) | PostgreSQL | ≥ lifecycle of AI system (Art. 12) |
| ASR audio inputs | Potentially personal | RAM only — not persisted | Not stored |
| Application logs | Pseudonymised (no PHI policy) | Docker logs / log aggregator | As per log retention policy |

---

## Legal Basis for Processing

Under GDPR Art. 9(2), processing special category health data requires one of the following:

- **Art. 9(2)(h)**: Processing for medical diagnosis, treatment, or healthcare management by or under the responsibility of a professional subject to professional secrecy
- **Art. 9(2)(j)**: Processing for scientific research (for research use)

The deploying organisation must document the applicable legal basis in their Art. 30 record and ensure that the use of Radiolyze AI assistance falls within the scope of the radiologist's professional responsibilities.

---

## GDPR Art. 30 — Record of Processing Activities (Template)

Complete this table for your organisation:

| Field | Value |
|---|---|
| Controller name | *(Organisation name)* |
| Controller contact | *(Name, address, email)* |
| DPO contact | *(Name, email — if DPO required)* |
| Processing purpose | AI-assisted radiology reporting; clinical workflow support |
| Legal basis | Art. 9(2)(h) — healthcare management *(confirm with DPO)* |
| Data subjects | Patients whose radiological studies are reported using Radiolyze |
| Data categories | Radiological images; reports; patient demographics; audit logs |
| Recipients | Radiologists, QA staff, IT admins (internal); no external data transfer |
| Third country transfers | None — on-premises deployment; no cloud egress |
| Retention | Clinical data: per national health records law; audit logs: per Art. 12 |
| TOMs | See Technical and Organisational Measures below |

---

## Technical and Organisational Measures (TOMs)

### Technical Measures

| Measure | Implementation |
|---|---|
| Encryption in transit | TLS 1.2+ for all HTTP endpoints (NGINX reverse proxy) |
| Encryption at rest | Managed by host OS / storage layer (institution responsibility) |
| Authentication | JWT-based session auth; password strength requirements |
| Authorisation | RBAC — radiologist, QA, admin roles; least-privilege principle |
| PHI exclusion from logs | Application logging policy: no patient name, DOB, or raw study data in logs |
| Audit trail | Immutable audit event log in PostgreSQL with input hashes |
| Network segmentation | DB, Redis, Orthanc not exposed beyond Docker internal network |
| Rate limiting | Upload and inference endpoints rate-limited (configurable) |

### Organisational Measures

| Measure | Deployer action required |
|---|---|
| Data Protection Officer | Appoint DPO if required; register contact |
| Staff training | Train staff on PHI handling and Radiolyze privacy controls |
| Access control review | Periodic review of user accounts and role assignments |
| Incident response | Maintain GDPR breach notification procedure (72-hour reporting) |
| Data Processing Agreement | Execute DPA with any processors (cloud backup, monitoring) |
| Backup encryption | Encrypt all backups at rest; control access to backup media |

---

## PHI Handling in Radiolyze

### What Radiolyze Does NOT Store

- Raw audio from ASR dictation (processed in-memory; audio hash only written to audit log)
- Patient-identifiable data in application logs (enforced by log sanitisation policy)
- Patient data outside the configured Orthanc and PostgreSQL volumes

### What Radiolyze Stores

- DICOM files in Orthanc (standard DICOM — includes patient demographics in tags)
- Radiology reports in PostgreSQL (includes findings text; linked to patient by study_id)
- Audit events in PostgreSQL (actor_id + study_id + input_hash; no raw findings text)

### Input Hashing

Audit events store SHA-256 hashes of AI inputs (findings text, audio) rather than the raw data. This provides traceability without duplicating PHI.

```python
# backend/app/services/audit_service.py
import hashlib

def hash_input(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]
```

---

## DICOM Anonymisation

For research use, training data preparation, or export to third parties, DICOM files must be anonymised before leaving the clinical environment.

Radiolyze does not perform anonymisation itself. Recommended tools:

| Tool | Use case |
|---|---|
| [Orthanc anonymisation](https://book.orthanc-server.com/users/anonymization.html) | Anonymise via Orthanc REST API |
| `pydicom` + DICOM PS3.15 Annex E profile | Scripted batch anonymisation |
| CTP (Clinical Trials Processor) | Hospital-grade DICOM de-identification pipeline |

**Before any export of DICOM data for research or training:**

1. Apply a validated DICOM de-identification profile (PS3.15 Annex E or stricter)
2. Verify no burnt-in patient identifiers remain in pixel data (CR/DX modalities are higher risk)
3. Document the anonymisation run in the Art. 30 record
4. Store anonymised data separately from clinical data

---

## EU AI Act Art. 10 — Training Data Governance

MedGemma (the AI model used in Radiolyze) was trained by Google DeepMind. Training data governance documentation is the responsibility of the model provider.

For the Radiolyze deployment layer:

| Requirement | Status |
|---|---|
| Training data — model provider documentation | Google DeepMind model card (see `docs/en/research/medgemma.md`) |
| Fine-tuning on local data | Not performed in reference implementation; if done, Art. 10 full documentation required |
| Validation data | Site-specific validation required before clinical use (see `docs/en/research/validation.md`) |
| Test data | Separate from training and validation; patient data only with appropriate legal basis |

If you fine-tune the model on local patient data, you must:
- Document the dataset (size, demographics, labelling process)
- Ensure appropriate legal basis for using patient data in training
- Conduct bias analysis across patient subgroups
- Re-run validation on held-out data

---

## Data Subject Rights

Under GDPR Chapter III, patients have rights to access, rectification, erasure, and portability of their data.

| Right | Mechanism in Radiolyze |
|---|---|
| Access | Radiology reports accessible via standard hospital HIS/RIS; audit logs via admin API |
| Rectification | Report correction supported via report editing workflow |
| Erasure (right to be forgotten) | Delete DICOM study from Orthanc + delete report from DB + purge audit events linking to study — requires admin procedure |
| Portability | DICOM export from Orthanc; report export via API |
| Restriction of processing | Deactivate user account; isolate study from workflow |

!!! danger "Erasure procedure"
    Deleting patient data for erasure requests must be coordinated with the institution's legal and clinical records teams. There may be conflicting obligations (clinical records retention laws). Do not delete data without legal guidance.

---

## Breach Notification

Under GDPR Art. 33, data breaches involving personal data must be reported to the supervisory authority within 72 hours if they pose a risk to individuals.

Relevant breach scenarios for Radiolyze:

- PHI found in application logs (check log aggregator immediately)
- Unauthorised access to PostgreSQL or Orthanc
- Backup media lost or stolen
- Ransomware affecting the Radiolyze server

For each scenario: isolate affected systems, preserve audit logs, notify DPO immediately, follow institution breach response procedure.

---

## Related

- [Security Hardening](../admin/security-hardening.md)
- [Audit Logging](audit-logging.md)
- [Risk Management](risk-management.md)
- [Evidence Overview](evidence-overview.md)
- [Internet Usage Policy](../operations/internet-usage.md)
