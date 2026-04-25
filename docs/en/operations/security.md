# Security

## Goals

- Protection of PHI and clinical workflows
- Traceability (Audit Logs)
- Minimized attack surface (on-prem, no egress)

## Transport

- TLS for all endpoints (termination via reverse proxy, e.g. NGINX/Ingress)
- Enable HSTS for UI domains (prod)
- Optional mTLS within the internal network (API <-> Worker)
- Do not expose internal traffic (DB/Redis/Orthanc) publicly

## AuthN/AuthZ

- JWT for UI <-> API (OIDC/OAuth2 recommended)
- RBAC for roles (Radiologist, QA, Admin)
- Service-to-service access: internal tokens or mTLS
- Orthanc DICOMweb uses Basic Auth (local: `orthanc/orthanc`)
- Rotate credentials for production without exception

### RBAC Baseline (Proposal)

| Role | Read | Edit | Approve | Admin/Config |
| --- | --- | --- | --- | --- |
| Radiologist | Yes | Yes | Yes | No |
| QA | Yes | No | No | No |
| Admin | Yes | Yes | Yes | Yes |

## Secrets & Keys

- Secrets must not be stored in the repo; use ENV/.env only (deployment)
- Rotate JWT secrets, DB passwords, Orthanc credentials
- Store backups encrypted (document key rotation)

## Data Handling

- No PHI in client-side logs
- Anonymize DICOM where possible
- Keep audit logs minimal (hashes instead of raw data)
- Restrict access to audit logs to Admin/Compliance roles only

## Rate Limiting

- API rate limits for uploads
- DoS protection via NGINX/Ingress
- Configure Slowloris/body size limits for uploads

## Network & Isolation

- Redis, Postgres, and Orthanc in internal network only
- No open ports for workers/queues
- Firewall allowlist for UI/API

## Backups & Recovery

- Regular DB backups (test restores)
- Document retention periods (compliance)

## Security Testing

- Regular SAST/dependency scans
- Pen test/threat model before production rollout

## Internet Usage

See [Internet Usage Strategy](internet-usage.md) for
egress policy, model updates, and audit.
