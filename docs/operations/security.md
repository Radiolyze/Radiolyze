# Security

## Transport

- TLS fuer alle Endpunkte
- Optional mTLS im internen Netzwerk

## AuthN/AuthZ

- JWT fuer UI <-> API
- RBAC fuer Rollen (Radiologe, Admin)
- Orthanc DICOMweb nutzt Basic Auth (lokal: `orthanc/orthanc`)
- Zugangsdaten fuer Prod unbedingt rotieren

## Data Handling

- Keine PHI in Client-Logs
- Anonymisierung von DICOM, wenn moeglich
- Audit Logs minimal halten (Hashes statt Rohdaten)

## Rate Limiting

- API Rate Limits fuer Uploads
- DoS Schutz via NGINX/Ingress

## Internetnutzung

Siehe [Internetnutzung Strategie](internet-usage.md) fuer
Egress-Policy, Modell-Updates und Audit.
