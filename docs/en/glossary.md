# Glossary

Definitions of terms used throughout the Radiolyze documentation. Grouped by domain.

---

## Regulatory & Compliance

**Annex IV** — The technical documentation structure required by EU AI Act for high-risk AI systems. Specifies what must be documented: system description, architecture, risk analysis, performance metrics, cybersecurity, and more. See [Annex IV](en/compliance/annex-iv.md).

**CE Marking** — A declaration by the manufacturer that a product meets EU regulatory requirements, including MDR (medical devices) and EU AI Act (high-risk AI systems). CE marking allows a product to be placed on the EU market.

**Conformity Assessment** — The process of demonstrating that a product meets applicable regulatory requirements. For high-risk AI systems, this involves either self-assessment or review by a Notified Body.

**DPA (Data Processing Agreement)** — A contract required under GDPR between a data controller and any processor that handles personal data on the controller's behalf. Required when using any third-party service that processes patient data.

**DPO (Data Protection Officer)** — An individual appointed under GDPR to oversee data protection compliance. Required for organisations that systematically process special category data (such as health records) on a large scale.

**EU AI Act** — Regulation (EU) 2024/1689 on artificial intelligence, establishing risk-based requirements for AI systems. Radiolyze is classified as a high-risk AI system under Annex III (medical AI used in clinical decision support). Full requirements apply: Art. 9 (risk management), Art. 10 (data governance), Art. 11 (technical documentation), Art. 12 (logging), Art. 13 (transparency), Art. 14 (human oversight), Art. 15 (robustness), Art. 72 (post-market monitoring).

**FMEA (Failure Mode and Effects Analysis)** — A systematic method for identifying potential failure modes in a system, their causes, effects, and severity. Required as part of ISO 14971 medical device risk management. See [Risk Management](en/compliance/risk-management.md).

**GDPR (General Data Protection Regulation)** — EU Regulation 2016/679 on personal data protection. Health/medical data is classified as "special category data" under Art. 9, requiring explicit legal basis for processing.

**ISO 14971** — International standard for the application of risk management to medical devices. Defines the process: risk analysis → risk evaluation → risk control → residual risk evaluation → post-production surveillance.

**MDR (Medical Device Regulation)** — EU Regulation 2017/745 on medical devices. AI clinical decision support systems may qualify as medical devices, triggering additional conformity assessment requirements.

**Notified Body** — An independent organisation designated by an EU member state to assess conformity of regulated products (medical devices, high-risk AI systems). Required for certain risk class medical devices; may be required for some high-risk AI systems.

**RPN (Risk Priority Number)** — In FMEA: Severity × Probability. Used to prioritise risk mitigation efforts. RPN ≥ 16 is unacceptable in Radiolyze's risk framework.

**TOM (Technical and Organisational Measure)** — Security and privacy measures required under GDPR Art. 32. Encompasses both technical controls (TLS, encryption, access control) and organisational controls (staff training, policies, procedures).

---

## Clinical & Radiology

**DICOMweb** — HTTP-based API for accessing and exchanging DICOM content. Three services: QIDO-RS (query), WADO-RS (retrieve), STOW-RS (store). Radiolyze uses Orthanc's DICOMweb implementation.

**DICOM (Digital Imaging and Communications in Medicine)** — The international standard for medical imaging data: file format, network protocol, and service classes. All radiology images in Radiolyze are stored and transferred as DICOM.

**DICOM SR (DICOM Structured Report)** — A standardised format for encoding clinical findings and measurements within DICOM. Radiolyze can export approved reports as DICOM SR for integration with PACS/RIS systems.

**HIS (Hospital Information System)** — The administrative system managing patient admissions, discharge, clinical documentation, and billing. Radiolyze integrates with HIS via HL7 worklists.

**Laterality** — The side of the body affected by a finding (left, right, bilateral). A common source of AI errors; the Radiolyze QA engine checks for laterality consistency.

**PACS (Picture Archiving and Communication System)** — The hospital system for long-term storage, retrieval, and display of medical images. Orthanc functions as a mini-PACS in Radiolyze.

**PHI (Protected Health Information)** — Any individually identifiable health information: patient name, date of birth, medical record number, study date, diagnoses, images. PHI must not appear in application logs (see [Security Hardening](en/admin/security-hardening.md)).

**RECIST (Response Evaluation Criteria in Solid Tumours)** — Standardised criteria for measuring tumour response to treatment using imaging. Radiolyze supports lesion measurement annotations in the DICOM viewer.

**RIS (Radiology Information System)** — The system managing the radiology department workflow: scheduling, worklists, order management, report distribution. Radiolyze is designed to integrate alongside a RIS.

**W/L (Window / Level)** — Also called windowing. A display technique that maps a range of Hounsfield Units (HU) to the greyscale display range, making specific tissue types visible. Window = display range width; Level = centre HU value. Examples: lung window (W:1500/L:-600), bone window (W:2000/L:400).

**Worklist (DICOM Modality Worklist)** — A DICOM service that pushes scheduled procedure information (patient demographics, study info) from RIS to imaging modalities, avoiding manual data entry.

---

## Technical

**ASR (Automatic Speech Recognition)** — Software that converts spoken dictation into text. Radiolyze supports two ASR providers: MedASR (local, medical vocabulary) and Whisper (OpenAI's open-source ASR model). Dictated audio is processed in-memory; only a hash is stored in the audit log.

**Audit Event** — A structured record written to the `audit_events` PostgreSQL table whenever a significant action occurs (report created, AI inference completed, report approved, etc.). Contains event_type, actor_id, study_id, timestamp, model_version, and input_hash. No raw PHI. See [Audit Logging](en/compliance/audit-logging.md).

**Drift Monitoring** — Ongoing measurement of AI output quality metrics over time to detect degradation (model drift, distribution shift). Radiolyze exposes `/api/v1/monitoring/drift` for this purpose.

**Docker Compose** — The container orchestration tool used to run all Radiolyze services (backend, frontend, PostgreSQL, Redis, Orthanc, vLLM) as a coordinated stack. Overlay files (`gpu.yml`, `rocm.yml`, `whisper.yml`) extend the base configuration.

**Guided JSON** — A vLLM feature that constrains the model's output to a specified JSON schema using grammar-based sampling. Used in Radiolyze to ensure MedGemma always outputs a valid structured response (`impression`, `key_findings`, `evidence_indices`).

**JWT (JSON Web Token)** — The authentication token format used in Radiolyze. The backend issues signed JWTs on login; all API requests include the token in the `Authorization: Bearer` header.

**MedGemma** — The multimodal AI model used in Radiolyze for radiology impression generation. Architecture: Gemma 2 language backbone + SigLIP vision encoder. Released by Google DeepMind. See [MedGemma](en/research/medgemma.md).

**MPR (Multi-Planar Reconstruction)** — A viewer technique for generating axial, coronal, and sagittal cross-sections from volumetric CT/MR data. Available in the Radiolyze DICOM viewer.

**QA (Quality Assurance)** — Automated checks applied to radiology reports before sign-off. Current rules include: laterality consistency, required section completeness, placeholder text detection. QA results are displayed inline and recorded in audit events.

**RAG (Retrieval Augmented Generation)** — An AI technique that combines a language model with a retrieval system to ground responses in external knowledge (e.g. clinical guidelines). Radiolyze has a guidelines panel that surfaces relevant protocols; RAG integration for automatic guideline injection is a planned feature.

**RBAC (Role-Based Access Control)** — Access control model where permissions are assigned to roles (radiologist, QA, admin), and users are assigned to roles. Ensures least-privilege access to patient data and system functions.

**Redis** — An in-memory data store used in Radiolyze as the message broker for the RQ task queue. Inference jobs are queued in Redis and processed by the worker service.

**RQ (Redis Queue)** — A Python task queue backed by Redis. Used in Radiolyze to handle asynchronous AI inference jobs without blocking the API response.

**SigLIP** — A vision-language contrastive encoder developed by Google, used as the image processing component of MedGemma. Processes images at up to 896×896 pixels into a fixed-size embedding.

**vLLM** — An open-source, GPU-accelerated inference server for large language models with an OpenAI-compatible API. Used to serve MedGemma in Radiolyze. Supports continuous batching, paged KV cache, and guided JSON output.

**VRT / 3D Rendering** — Volume Rendering Technique. A viewer mode that generates a 3D visualisation from volumetric CT/MR data. Available in the Radiolyze viewer with presets: angio, bone, lung, soft tissue, cardiac.

---

## Abbreviations Quick Reference

| Abbreviation | Full form |
|---|---|
| ASR | Automatic Speech Recognition |
| DICOM | Digital Imaging and Communications in Medicine |
| DPA | Data Processing Agreement |
| DPO | Data Protection Officer |
| FMEA | Failure Mode and Effects Analysis |
| GDPR | General Data Protection Regulation |
| HIS | Hospital Information System |
| ISO | International Organisation for Standardisation |
| JWT | JSON Web Token |
| MDR | Medical Device Regulation (EU 2017/745) |
| MPR | Multi-Planar Reconstruction |
| PACS | Picture Archiving and Communication System |
| PHI | Protected Health Information |
| QA | Quality Assurance |
| QIDO-RS | Query based on ID for DICOM Objects by RESTful Services |
| RAG | Retrieval Augmented Generation |
| RBAC | Role-Based Access Control |
| RECIST | Response Evaluation Criteria in Solid Tumours |
| RIS | Radiology Information System |
| RPN | Risk Priority Number |
| RQ | Redis Queue |
| SR | Structured Report (DICOM) |
| TLS | Transport Layer Security |
| TOM | Technical and Organisational Measure |
| VRT | Volume Rendering Technique |
| WADO-RS | Web Access to DICOM Objects by RESTful Services |
| W/L | Window / Level |
