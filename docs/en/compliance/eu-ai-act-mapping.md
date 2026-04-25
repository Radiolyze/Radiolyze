# EU AI Act Mapping

This table maps requirements to the planned system components.

| Article | Requirement | Implementation |
| --- | --- | --- |
| Art. 9 | Risk Management | Risk analysis, mitigations in the orchestrator |
| Art. 10 | Data Governance | DICOM anonymisation, dataset documentation |
| Art. 11 | Technical Documentation | Architecture + model cards + tests |
| Art. 12 | Logs | Audit logger service + DB |
| Art. 13 | Transparency | UI status + explainability hints |
| Art. 14 | Human Oversight | Approval dialog + editability |
| Art. 15 | Robustness | Fallback UI + error handling |
| Art. 72 | Monitoring | Drift checks + incident process |
| Annex IV | Technical Documentation | `docs/compliance/annex-iv.md` |

## Evidence Artefacts (Examples)

- Audit log export (JSON)
- QA reports (CSV/JSON)
- Model version history
- Security tests (pen test report)
- Annex IV documentation (template)
