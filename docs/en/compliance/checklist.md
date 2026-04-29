# Compliance Checklist

Use this checklist to track compliance readiness before deploying Radiolyze in a clinical environment. Each item links to the relevant documentation where you can find evidence templates and guidance.

!!! tip "How to use"
    Work through this checklist with your compliance officer, DPO, and clinical lead. Items marked ✅ are implemented in the reference code. Items marked 🔲 require deployer action before production use.

---

## EU AI Act (High-Risk AI System)

### Art. 9 — Risk Management

- [x] **Risk Management Plan exists** — see [Risk Management](risk-management.md)
- [ ] **Formal FMEA completed with clinical input** — use the FMEA table in [Risk Management](risk-management.md); values need clinical validation  
  *Action: Engage radiologist lead and risk management expert to review and sign off.*
- [x] **Mitigation measures implemented** — human approval dialog, QA engine, audit trail, UI transparency
- [ ] **Residual risk formally accepted** — document acceptance with signatures from medical director and compliance officer  
  *Action: Print risk-management.md § Residual Risk; obtain sign-off.*
- [ ] **Risk review schedule established** — at minimum: on model update, on incident, annually  
  *Action: Add to operational calendar.*

### Art. 10 — Data Governance

- [x] **PHI exclusion from application logs implemented** — log sanitisation policy active (see [Security Hardening](../admin/security-hardening.md))
- [x] **Audit events use input hashing, not raw PHI** — SHA-256 hash of findings text / audio (see [Audit Logging](audit-logging.md))
- [ ] **GDPR Art. 30 record of processing completed** — use template in [Data Protection](datenschutz.md)  
  *Action: Complete org-specific fields (controller, DPO, legal basis, retention periods).*
- [ ] **Legal basis for processing health data confirmed** — Art. 9(2)(h) or 9(2)(j) as applicable  
  *Action: Confirm with DPO and document in Art. 30 record.*
- [ ] **DICOM anonymisation procedure documented** — required if data used for research/training  
  *Action: See [Data Protection § Anonymisation](datenschutz.md#dicom-anonymisation).*
- [ ] **Data Processing Agreements executed** — for any external processors (cloud backup, monitoring)  
  *Action: Legal review of any third-party data processors.*

### Art. 11 — Technical Documentation

- [x] **Annex IV template filled** — see [Annex IV](annex-iv.md)
- [x] **Architecture documented** — see [Architecture Overview](../architecture/overview.md)
- [x] **Data flow documented** — see [Data Flow](../architecture/data-flow.md)
- [x] **MedGemma model card** — see [Model Card – MedGemma](model-card-medgemma.md)
- [ ] **Site-specific validation results documented** — required before clinical use  
  *Action: Run validation study on local data; document in [Validation Guide](../research/validation.md).*
- [ ] **Open items from Annex IV § 15 resolved** — FMEA, model cards, RBAC, monitoring  
  *Action: Review Annex IV § 15; assign owners and deadlines.*

### Art. 12 — Automatic Logs (Audit Trail)

- [x] **Audit logger active** — all 7 logging points implemented (see [Audit Logging](audit-logging.md))
- [x] **Audit events stored in PostgreSQL with required fields** — event_type, actor_id, study_id, report_id, timestamp, model_version, input_hash
- [ ] **Audit log retention configured** — minimum: AI system lifetime  
  *Action: Set retention policy; configure backup (see [Backup & Recovery](../admin/backup-recovery.md)).*
- [ ] **Audit log access restricted** — only admin and compliance roles  
  *Action: Verify RBAC configuration blocks non-admin access to `/api/v1/audit`.*
- [ ] **Audit export tested** — verify `curl /api/v1/audit?export=json` returns complete records  
  *Action: See [Evidence Overview § Art. 12](evidence-overview.md) for export commands.*

### Art. 13 — Transparency

- [x] **AI status displayed in UI** — model name, version, and inference status visible in report workspace
- [x] **AI disclaimer shown to users** — warning admonition in reporting UI
- [x] **User documentation explains AI capabilities and limitations** — see [AI Guide](../doctors/ki-grundlagen.md)
- [ ] **Patient-facing transparency notice** — required if patients interact with system directly  
  *Action: Confirm with legal whether patient-facing notice is required in your jurisdiction.*

### Art. 14 — Human Oversight

- [x] **Every report requires explicit radiologist approval** — approval dialog implemented; no auto-sign pathway
- [x] **All AI outputs are editable** — impression text field is fully editable before and after AI generation
- [x] **Fallback on AI failure** — system remains usable when AI inference fails (manual dictation/typing supported)
- [x] **QA check before sign-off** — automated QA engine runs; warnings surfaced to radiologist
- [ ] **Staff trained on human oversight requirements** — radiologists must understand they are responsible for every signed report  
  *Action: Include in onboarding; reference [AI Guide § Responsibility](../doctors/ki-grundlagen.md).*

### Art. 15 — Robustness & Cybersecurity

- [ ] **TLS enabled for all endpoints** — required for production  
  *Action: See [Security Hardening § TLS](../admin/security-hardening.md).*
- [ ] **Default credentials changed** — Orthanc, PostgreSQL, JWT secret  
  *Action: See [Security Hardening § Change Default Credentials](../admin/security-hardening.md).*
- [x] **Rate limiting configured** — upload and inference endpoints rate-limited
- [x] **Network segmentation** — DB/Redis/Orthanc not exposed beyond Docker network
- [ ] **Penetration test completed** — recommended before production deployment  
  *Action: Engage qualified security firm.*
- [ ] **Dependency vulnerability scan run** — `pip-audit` + `npm audit`  
  *Action: See [Evidence Overview § Art. 15](evidence-overview.md) for commands.*
- [ ] **Security hardening checklist completed** — see [Security Hardening](../admin/security-hardening.md)

### Art. 72 — Post-Market Monitoring

- [x] **Drift monitoring endpoint active** — `/api/v1/monitoring/drift` returns QA acceptance rate and metrics
- [ ] **Monitoring dashboard configured** — alerts on QA failure rate, inference error rate  
  *Action: See [Observability](../operations/observability.md); set alert thresholds.*
- [ ] **Incident response procedure established** — formal process for AI errors or safety events  
  *Action: Adapt [Runbook § Incident Response](../operations/runbook.md) to your organisation.*
- [ ] **Post-market monitoring schedule set** — minimum: quarterly review of drift metrics; annual full review  
  *Action: Add to operational calendar.*

---

## Security Baselines

- [ ] **TLS for all endpoints** — see [Security Hardening](../admin/security-hardening.md)
- [ ] **Strong authentication configured** — JWT secret ≥ 32 bytes; session expiry set
- [ ] **RBAC roles defined and assigned** — radiologist, QA, admin roles
- [ ] **Rate limiting active and tested**
- [x] **No PHI in application logs** — policy enforced; verify with log review
- [x] **Security hardening documentation complete** — see [Security Hardening](../admin/security-hardening.md)
- [ ] **Backup procedure tested** — restore from backup verified on test instance  
  *Action: See [Backup & Recovery](../admin/backup-recovery.md) § Verification Plan.*
- [ ] **Access to backup files restricted** — backup directory accessible only to root / backup service account

---

## Before Going Live — Minimum Requirements

These items **must** be complete before first clinical use:

1. ✅ Approval dialog active (human oversight)
2. 🔲 Default credentials changed (Orthanc, PostgreSQL, JWT)
3. 🔲 TLS enabled
4. 🔲 Audit log retention configured and tested
5. 🔲 GDPR Art. 30 record completed
6. 🔲 Legal basis for health data processing confirmed
7. 🔲 Radiologist staff trained on AI responsibilities
8. 🔲 Backup procedure verified

---

## Related

- [Evidence Overview](evidence-overview.md) — all artefacts with export commands
- [Risk Management](risk-management.md) — FMEA and mitigation measures
- [Data Protection](datenschutz.md) — GDPR compliance
- [Annex IV](annex-iv.md) — full technical documentation template
- [Audit Logging](audit-logging.md) — audit event schema and export
- [Security Hardening](../admin/security-hardening.md) — production security steps
