# Frequently Asked Questions

Questions are grouped by role. Use the search bar or jump to your section:

- [For Radiologists & Physicians](#for-radiologists--physicians)
- [For Administrators](#for-administrators)
- [For Researchers & AI Specialists](#for-researchers--ai-specialists)
- [For Compliance Officers](#for-compliance-officers)
- [General](#general)

---

## For Radiologists & Physicians

**Do I need technical knowledge to use Radiolyze?**

No. Daily use (opening studies, dictating findings, reviewing AI suggestions, approving reports) requires no technical knowledge. Configuration and deployment are handled by your IT administrator.

---

**How do I start reporting on a study?**

Click a study in the worklist on the left sidebar. The DICOM viewer loads the images in the centre. Open the Findings panel on the right, start voice dictation or type your findings, then click "Generate Impression" to receive an AI draft. Review the draft, edit if necessary, and click "Approve" to finalise.

Full walkthrough: [Fast Reporting Workflow](workflows/fast-report.md)

---

**The AI draft is wrong. What should I do?**

Always review and correct the AI draft before approval. Radiolyze requires your explicit approval — no report is saved without it. Simply edit the impression text in the panel. Your correction is logged in the audit trail. The AI is a writing assistant, not a diagnostic authority.

---

**Is the AI making the diagnosis for me?**

No. The AI generates a draft based on image analysis. The radiologist is always responsible for the final report. All AI outputs are labelled as drafts, and the approval step is mandatory. See [What Radiolyze is not](getting-started/index.md#what-radiolyze-is-not).

---

**Can I use my own report templates?**

Yes. Institutional report templates can be configured in the Templates panel. Contact your administrator to add templates. Custom templates are applied to the Findings and Impression panels during reporting.

---

**Voice dictation is not recognising me. What do I do?**

Check the following:
1. Microphone is connected and browser permissions are granted.
2. The correct microphone is selected in your browser or OS settings.
3. If using Whisper: the Whisper service is running (`docker compose ps`).
4. Speak clearly and at normal pace — medical ASR is optimised for clinical terminology.

---

**Can I compare with previous studies?**

Yes. The Prior Studies panel in the left sidebar shows previous studies for the same patient. Clicking one opens it in split-view alongside the current study, with synchronised scrolling.

---

## For Administrators

**What are the minimum hardware requirements?**

| Component | Minimum | Recommended (with AI) |
|---|---|---|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16–32 GB |
| GPU | Not required | NVIDIA, ≥16 GB VRAM |
| Storage | 20 GB (stack) | 100+ GB (DICOM archive) |
| OS | Linux | Ubuntu 22.04 LTS |
| Docker | 24.x + Compose v2 | Latest stable |

---

**Does Radiolyze require an internet connection?**

No — after initial setup it can run fully air-gapped. An internet connection is needed at setup time to pull Docker images and, if using MedGemma, to download the model from Hugging Face. After that, all processing is local.

See [Internet Usage Policy](operations/internet-usage.md) for details.

---

**How do I enable GPU acceleration?**

Install the NVIDIA Container Toolkit and use the GPU Docker Compose overlay:

```bash
sudo ./scripts/setup-nvidia-docker.sh
docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up --build
```

For AMD GPUs use the ROCm overlay. See [Quickstart](getting-started/quickstart.md#optional-enable-gpu--ai-nvidia).

---

**Is Radiolyze production-ready out of the box?**

No. The default setup is a reference implementation suitable for evaluation and development. Before clinical use you must configure:

- TLS termination (HTTPS)
- Authentication and RBAC
- Firewall and network isolation
- Backup and recovery
- Security hardening

See the [Administration Guide](admin/index.md) and [Compliance Checklist](compliance/checklist.md).

---

**Can I run Radiolyze on-premises?**

Yes. The architecture is designed for on-premises or private cloud deployment. All services run in Docker containers; no data leaves your network during operation.

---

**How do I load my own DICOM studies?**

Send studies to the Orthanc PACS via:
- **DICOM C-STORE** — configure your modality or worklist manager to send to Orthanc.
- **DICOMweb STOW-RS** — `POST /dicom-web/studies` on the Orthanc endpoint.
- **Orthanc UI** — drag and drop DICOM files at `http://<host>:8042`.

---

**How do I change the default Orthanc credentials?**

Set the `VITE_DICOM_WEB_USERNAME` and `VITE_DICOM_WEB_PASSWORD` environment variables in your `.env` file, and configure matching credentials in the Orthanc configuration. Never use the default `orthanc/orthanc` credentials in production.

---

**How do I back up patient data?**

Three components hold persistent data:

1. **PostgreSQL** — reports and audit events. Use `pg_dump` or a managed backup solution.
2. **Orthanc** — DICOM studies. Use Orthanc's built-in export or filesystem backup of the data volume.
3. **Audit logs** — stored in PostgreSQL; covered by the database backup.

Test restores regularly. Document retention periods to meet local regulatory requirements.

---

## For Researchers & AI Specialists

**Which AI model does Radiolyze use?**

The default AI model is [MedGemma](https://huggingface.co/google/medgemma) by Google — a multimodal model fine-tuned for medical imaging. It is served via [vLLM](https://github.com/vllm-project/vllm) with an OpenAI-compatible API.

See [MedGemma Model Guide](research/index.md) for capabilities and limitations.

---

**Can I replace MedGemma with a different model?**

Yes. The inference client (`backend/app/inference_clients.py`) uses an OpenAI-compatible API. Any model served by vLLM, Ollama, or a compatible endpoint can be substituted by changing the `INFERENCE_BASE_URL` and `INFERENCE_MODEL` environment variables.

See [Switching the Inference Backend](research/index.md#switching-the-inference-backend).

---

**Where can I find the model's performance data?**

The [MedGemma Model Card](compliance/model-card-medgemma.md) documents known capabilities, limitations, and bias considerations. For local clinical validation, see the [Validation Guide](research/index.md#validation--benchmarking).

---

**How is patient data protected during AI inference?**

Images are sent to the vLLM inference service running locally — no external API calls are made. Images are encoded as base64 frames and transmitted over the internal Docker network. No PHI is logged in inference request/response payloads. The audit log records only hashes and metadata, not image data.

---

**Can I customise the prompts used for AI reporting?**

Yes. Prompt templates are defined in `backend/app/prompts.py`. Edit them to adjust the style, structure, or clinical focus of AI-generated reports. Changes take effect on the next inference call without restarting the backend.

---

## For Compliance Officers

**How does Radiolyze comply with the EU AI Act?**

Radiolyze implements requirements for high-risk AI systems under the EU AI Act:

| Article | Requirement | Implementation |
|---|---|---|
| Art. 9 | Risk Management | FMEA table (Annex IV § 8.1), QA checks |
| Art. 10 | Data Governance | On-prem DICOM (Orthanc), anonymisation module |
| Art. 12 | Logging & Traceability | Audit logger, PostgreSQL `audit_events` table |
| Art. 13 | Transparency | AI confidence labels, model version in UI |
| Art. 14 | Human Oversight | Mandatory approval dialog, all outputs editable |
| Art. 15 | Robustness | Fallback UI, error handling, TLS (pending) |
| Art. 72 | Post-Market Monitoring | Drift snapshot scheduler, KPI dashboard |

Full mapping: [EU AI Act Mapping](compliance/eu-ai-act-mapping.md)

---

**Where are the audit logs stored?**

Audit events are stored in the PostgreSQL `audit_events` table. Each event records: timestamp, user, session, event type, report ID, AI model version, inference duration, and a hash of the input data.

---

**Can I export the audit logs?**

Yes. Use the REST API:

```bash
GET /api/v1/audit?export=json
```

The endpoint returns all audit events in JSON format. Restrict access to this endpoint to admin/compliance roles.

See [Audit Logging](compliance/audit-logging.md) for the full schema and retention guidance.

---

**Is Radiolyze a medical device under MDR?**

This depends on the intended use defined by the deploying institution. If used to support diagnosis, it may qualify as a Class IIa or IIb device under EU MDR 2017/745. A formal conformity assessment with a Notified Body is required for clinical deployment. Radiolyze provides the technical documentation framework (Annex IV) but does not constitute CE marking.

See [Annex IV Template](compliance/annex-iv.md) and the open items in [EU AI Act Mapping](compliance/eu-ai-act-mapping.md#open-items-until-conformity-assessment).

---

**What technical documentation is available for regulators?**

- [Annex IV Technical Documentation](compliance/annex-iv.md)
- [Model Card (MedGemma)](compliance/model-card-medgemma.md)
- [EU AI Act Mapping](compliance/eu-ai-act-mapping.md)
- [Audit Logging Implementation](compliance/audit-logging.md)
- [Architecture Overview](architecture/overview.md)

---

## General

**What languages does the documentation support?**

English and German. Use the language switcher in the top navigation bar.

---

**Where do I report bugs or request features?**

Open an issue on [GitHub](https://github.com/radiolyze/radiolyze/issues). See [Contributing Guidelines](development/contributing.md) for the process.

---

**What licence does Radiolyze use?**

Proprietary — all rights reserved. See the `LICENSE` file in the repository root.
