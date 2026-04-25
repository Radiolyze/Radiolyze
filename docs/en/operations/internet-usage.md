# Internet Usage Strategy

## Goals

- On-prem operation without external data flows
- EU-compliant processing (no PHI leaving the premises)
- Traceable updates and audit trail

## Principles

1. Inference remains local (MedGemma/MedASR).
2. No external API calls from the production network.
3. Internet access only for controlled updates.
4. Telemetry and auto-updates are disabled.

## Permitted Egress Connections

- Package and model updates via approved mirrors/registries
- Time windows and change approval required
- Log all downloads (hash + version)

## Model Lifecycle

- Models are mirrored to an internal registry
- Verify signature/checksum
- Approval process required before deployment

## Operations and Monitoring

- Egress proxy/allowlist at the firewall
- Audit logs for update events
- Regular review of dependencies

## Exceptions

- Emergency patches only with security approval
- Document the deviation in the audit log
