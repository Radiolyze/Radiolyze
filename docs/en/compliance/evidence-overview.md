# Evidence Overview

All compliance artefacts required for EU AI Act conformity assessment, grouped by Article. Use this page as your audit preparation checklist.

---

## How to Use This Page

Each row lists:

- **Artefact** — what the evidence item is
- **Location** — where to find it in the repository or system
- **Format** — file type / export format
- **How to export** — command or UI path to retrieve it

Generate evidence packages before any notified body audit, regulatory submission, or internal compliance review.

---

## Art. 9 — Risk Management

| Artefact | Location | Format | How to export |
|---|---|---|---|
| Risk Management Plan | `docs/en/compliance/risk-management.md` | Markdown | Download from repo |
| FMEA Table | `docs/en/compliance/risk-management.md` (§ FMEA) | Markdown table | Copy / print |
| Mitigation Evidence — Human Oversight | `docs/en/compliance/annex-iv.md` § 9 | Markdown | Download from repo |
| Residual Risk Acceptance Record | `docs/en/compliance/risk-management.md` (§ Residual Risk) | Markdown | Download from repo |

**Status:** Partially complete. FMEA template exists; formal FMEA with clinical input is an open item.

---

## Art. 10 — Data Governance

| Artefact | Location | Format | How to export |
|---|---|---|---|
| Data Governance Policy | `docs/en/compliance/datenschutz.md` | Markdown | Download from repo |
| GDPR Record of Processing (Art. 30) | `docs/en/compliance/datenschutz.md` (§ Art. 30) | Markdown table | Download / print |
| PHI-in-logs policy | `docs/en/operations/security.md` | Markdown | Download from repo |
| DICOM anonymisation policy | `docs/en/compliance/datenschutz.md` (§ Anonymisation) | Markdown | Download from repo |
| Training data documentation | `docs/en/research/medgemma.md` (§ Training Data) | Markdown | Download from repo |

**Status:** Partially complete. Core policy documented; Art. 30 register needs organisation-specific completion.

---

## Art. 11 — Technical Documentation

| Artefact | Location | Format | How to export |
|---|---|---|---|
| Annex IV template (filled) | `docs/en/compliance/annex-iv.md` | Markdown | Download from repo |
| System architecture overview | `docs/en/architecture/overview.md` | Markdown + diagrams | Download from repo |
| Data flow diagram | `docs/en/architecture/data-flow.md` | Markdown + diagram | Download from repo |
| MedGemma model card | `docs/en/research/medgemma.md` | Markdown | Download from repo |
| Frontend component docs | `docs/en/components/` | Markdown | Download from repo |
| API schema | `docs/en/api/schemas.md` | Markdown | Download from repo |
| Validation / benchmark results | `docs/en/research/validation.md` | Markdown + tables | Download from repo |

**Status:** Partially complete. Architecture documented; validation results require site-specific clinical testing.

---

## Art. 12 — Audit Logging

| Artefact | Location | Format | How to export |
|---|---|---|---|
| Audit log schema | `docs/en/compliance/audit-logging.md` | Markdown | Download from repo |
| Live audit event export | `/api/v1/audit?export=json` | JSON | See command below |
| Audit event count / period report | PostgreSQL `audit_events` table | SQL / CSV | See command below |

**Export commands:**

```bash
# Full audit log export (JSON)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/audit?export=json" \
  > audit_export_$(date +%Y%m%d).json

# Count by event type (SQL)
docker compose exec postgres psql -U postgres radiolyze \
  -c "SELECT event_type, COUNT(*) FROM audit_events GROUP BY event_type ORDER BY COUNT DESC;"

# Export as CSV
docker compose exec postgres psql -U postgres radiolyze \
  -c "\COPY audit_events TO '/tmp/audit.csv' CSV HEADER;"
docker compose cp postgres:/tmp/audit.csv ./audit_export_$(date +%Y%m%d).csv
```

**Status:** Active. Audit logger stores events for all 7 defined logging points.

---

## Art. 13 — Transparency

| Artefact | Location | Format | How to export |
|---|---|---|---|
| User-facing AI disclaimer (UI) | Report workspace header | Screenshot | Browser screenshot |
| AI capabilities documentation | `docs/en/doctors/ki-grundlagen.md` | Markdown | Download from repo |
| Model version display in UI | Report workspace → AI panel | Screenshot | Browser screenshot |
| Transparency statement (Annex IV § 2) | `docs/en/compliance/annex-iv.md` § 2 | Markdown | Download from repo |

**Status:** UI transparency elements active. Formal transparency notice for patient-facing use (if applicable) needs legal review.

---

## Art. 14 — Human Oversight

| Artefact | Location | Format | How to export |
|---|---|---|---|
| Human oversight design description | `docs/en/compliance/annex-iv.md` § 9 | Markdown | Download from repo |
| Approval dialog specification | `docs/en/doctors/workflow-befundung.md` § 7 | Markdown | Download from repo |
| Override / edit capability | `docs/en/doctors/ki-grundlagen.md` (§ Limitations) | Markdown | Download from repo |
| Keyboard shortcut reference | `docs/en/doctors/tastenkuerzel.md` | Markdown | Download from repo |

**Status:** Human oversight workflow fully implemented (approval dialog, editability, QA gate).

---

## Art. 15 — Robustness & Cybersecurity

| Artefact | Location | Format | How to export |
|---|---|---|---|
| Security hardening guide | `docs/en/admin/security-hardening.md` | Markdown | Download from repo |
| Internet usage policy | `docs/en/operations/internet-usage.md` | Markdown | Download from repo |
| Penetration test report | (external) | PDF | Engage qualified security firm |
| Dependency vulnerability scan | Run `pip-audit` / `npm audit` | Text | See command below |
| TLS configuration | `docs/en/admin/security-hardening.md` § TLS | Markdown | Download from repo |

**Dependency scan commands:**

```bash
# Python dependencies
pip-audit --requirement backend/requirements.txt

# Node dependencies
cd frontend && npm audit --audit-level=high
```

**Status:** Hardening documented. Formal penetration test and dependency audit are open items for production deployment.

---

## Art. 72 — Post-Market Monitoring

| Artefact | Location | Format | How to export |
|---|---|---|---|
| Post-market monitoring plan | `docs/en/compliance/annex-iv.md` § 12 | Markdown | Download from repo |
| Drift monitoring setup | `docs/en/operations/observability.md` | Markdown | Download from repo |
| QA acceptance rate report | `/api/v1/monitoring/drift` | JSON | `curl http://localhost:8000/api/v1/monitoring/drift` |
| Incident response procedure | `docs/en/operations/runbook.md` § Incident Response | Markdown | Download from repo |

**Status:** Drift endpoint active. Formal KPI dashboards and incident register are open items.

---

## Security Baselines

| Artefact | Location | Format | How to export |
|---|---|---|---|
| Security policy | `docs/en/operations/security.md` | Markdown | Download from repo |
| Production security checklist | `docs/en/admin/security-hardening.md` (§ Production Checklist) | Markdown | Download from repo |
| RBAC role definitions | `docs/en/admin/deployment.md` (§ Env Vars) | Markdown | Download from repo |

---

## Generating a Full Evidence Package

To collect all exportable artefacts in one step:

```bash
#!/bin/bash
EXPORT_DIR="./compliance-evidence-$(date +%Y%m%d)"
mkdir -p "$EXPORT_DIR"

# 1. Audit log
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/audit?export=json" \
  > "$EXPORT_DIR/audit_events.json"

# 2. Drift metrics
curl -s "http://localhost:8000/api/v1/monitoring/drift" \
  > "$EXPORT_DIR/drift_metrics.json"

# 3. Model version (from last audit event)
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/audit?limit=1" \
  > "$EXPORT_DIR/model_version.json"

# 4. Documentation snapshot
cp -r docs/ "$EXPORT_DIR/docs/"

echo "Evidence package written to $EXPORT_DIR"
```

---

## Open Items Summary

| Item | Article | Priority |
|---|---|---|
| Formal FMEA with clinical input | Art. 9 | High |
| Organisation-specific Art. 30 record | Art. 10 | High |
| Site-specific clinical validation results | Art. 11 | High |
| Penetration test report | Art. 15 | High |
| KPI / drift dashboard | Art. 72 | Medium |
| Patient-facing transparency notice | Art. 13 | Medium (if applicable) |
| Formal incident register | Art. 72 | Medium |

---

## Related

- [Compliance Checklist](checklist.md)
- [Annex IV Technical Documentation](annex-iv.md)
- [Audit Logging](audit-logging.md)
- [Risk Management](risk-management.md)
- [EU AI Act Mapping](eu-ai-act-mapping.md)
