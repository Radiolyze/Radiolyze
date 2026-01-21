# Security

## Ziele

- Schutz von PHI und klinischen Workflows
- Nachvollziehbarkeit (Audit Logs)
- Minimierte Angriffsoberflaeche (On-Prem, kein Egress)

## Transport

- TLS fuer alle Endpunkte (Terminierung via Reverse Proxy, z.B. NGINX/Ingress)
- HSTS fuer UI Domains aktivieren (Prod)
- Optional mTLS im internen Netzwerk (API <-> Worker)
- Interner Traffic (DB/Redis/Orthanc) nicht oeffentlich exponieren

## AuthN/AuthZ

- JWT fuer UI <-> API (OIDC/OAuth2 empfohlen)
- RBAC fuer Rollen (Radiologe, QA, Admin)
- Service-to-Service Access: interne Tokens oder mTLS
- Orthanc DICOMweb nutzt Basic Auth (lokal: `orthanc/orthanc`)
- Zugangsdaten fuer Prod unbedingt rotieren

### RBAC Baseline (Vorschlag)

| Rolle | Lesen | Editieren | Freigeben | Admin/Config |
| --- | --- | --- | --- | --- |
| Radiologe | Ja | Ja | Ja | Nein |
| QA | Ja | Nein | Nein | Nein |
| Admin | Ja | Ja | Ja | Ja |

## Secrets & Keys

- Secrets nicht im Repo, nur via ENV/.env (Deployment)
- Rotation fuer JWT Secrets, DB Passwoerter, Orthanc Credentials
- Backups verschluesselt speichern (Key Rotation dokumentieren)

## Data Handling

- Keine PHI in Client-Logs
- Anonymisierung von DICOM, wenn moeglich
- Audit Logs minimal halten (Hashes statt Rohdaten)
- Zugriff auf Audit Logs nur fuer Admin/Compliance Rollen

## Rate Limiting

- API Rate Limits fuer Uploads
- DoS Schutz via NGINX/Ingress
- Slowloris/Body Size Limits fuer Uploads konfigurieren

## Netzwerk & Isolation

- Redis, Postgres und Orthanc nur im internen Netzwerk
- Keine offenen Ports fuer Worker/Queues
- Firewall Allowlist fuer UI/API

## Backups & Recovery

- Regelmaessige DB Backups (Tests fuer Restore)
- Aufbewahrungsfristen dokumentieren (Compliance)

## Security Testing

- SAST/Dependency Scans regelmaessig
- Pen-Test/Threat Model vor Prod Rollout

## Internetnutzung

Siehe [Internetnutzung Strategie](internet-usage.md) fuer
Egress-Policy, Modell-Updates und Audit.
