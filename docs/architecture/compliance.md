# Compliance (EU AI Act)

## Anforderungen (High-Risk Use Case)

Die Anwendung faellt in den High-Risk Bereich (medizinische Diagnostik).
Relevante Artikel:

- Art. 9: Risk Management
- Art. 10: Data Governance
- Art. 11: Technische Dokumentation
- Art. 12: Automatische Logs
- Art. 13: Transparenz
- Art. 14: Human Oversight
- Art. 15: Robustheit/Sicherheit
- Art. 72: Post-Market Monitoring

## Umsetzung im Stack

- **Audit Logging**: Alle Events (ASR, AI, QA, Freigabe).
- **Human Oversight**: Freigabe-Dialog + Editiermoeglichkeit.
- **Transparenz**: Anzeige von AI-Status, QA und Modellversion.
- **Post-Market**: Drift Detection (geplant) und Incident Prozess.

## Nachweise

- Technische Doku (Architektur, Model Cards, Tests)
- Audit Log Export (JSON)
- Sicherheitskonzept (TLS, Auth, RBAC)

## Weitere Dokumente

- [Compliance Checklist](../compliance/checklist.md)
- [Audit Logging](../compliance/audit-logging.md)
- [EU AI Act Mapping](../compliance/eu-ai-act-mapping.md)
- [Internetnutzung Strategie](../operations/internet-usage.md)
