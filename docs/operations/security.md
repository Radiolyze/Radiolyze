# Security

## Transport

- TLS fuer alle Endpunkte
- Optional mTLS im internen Netzwerk

## AuthN/AuthZ

- JWT fuer UI <-> API
- RBAC fuer Rollen (Radiologe, Admin)

## Data Handling

- Keine PHI in Client-Logs
- Anonymisierung von DICOM, wenn moeglich
- Audit Logs minimal halten (Hashes statt Rohdaten)

## Rate Limiting

- API Rate Limits fuer Uploads
- DoS Schutz via NGINX/Ingress
