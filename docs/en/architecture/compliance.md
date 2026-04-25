# Compliance (EU AI Act)

## Requirements (High-Risk Use Case)

The application falls into the high-risk category (medical diagnostics).
Relevant articles:

- Art. 9: Risk Management
- Art. 10: Data Governance
- Art. 11: Technical Documentation
- Art. 12: Automatic Logs
- Art. 13: Transparency
- Art. 14: Human Oversight
- Art. 15: Robustness/Safety
- Art. 72: Post-Market Monitoring

## Implementation in the Stack

- **Audit Logging**: All events (ASR, AI, QA, sign-off).
- **Human Oversight**: Sign-off dialog + ability to edit.
- **Transparency**: Display of AI status, QA results, and model version.
- **Post-Market**: Drift detection (planned) and incident process.

## Evidence

- Technical documentation (architecture, model cards, tests)
- Audit log export (JSON)
- Security concept (TLS, auth, RBAC)
- Annex IV template (docs/compliance/annex-iv.md)

## Further Documents

- [Compliance Checklist](../compliance/checklist.md)
- [Audit Logging](../compliance/audit-logging.md)
- [EU AI Act Mapping](../compliance/eu-ai-act-mapping.md)
- [Internet Usage Strategy](../operations/internet-usage.md)
