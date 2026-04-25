# ADR-0001: Open Radiology Stack

## Status

Accepted

## Context

The project requires an open, EU-compliant architecture with a high degree of
control over data and models.

## Decision

We use:

- Orthanc (DICOM + DICOMweb)
- FastAPI orchestrator
- MedASR + MedGemma inference
- RAG for guidelines/templates
- DICOM SR for the final report

## Consequences

- Self-hosting is possible (on-prem)
- Compliance must be actively managed
- Additional effort required for operations, monitoring, and QA
