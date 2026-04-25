# System Context

## Actors

- Radiologist (report authoring and sign-off)
- PACS / DICOM source (image data)
- Orthanc (DICOM routing + DICOMweb)
- FastAPI orchestrator (workflow and audit)
- ASR/inference worker (MedASR, MedGemma)
- Compliance repository (audit logs, EU AI Act)

## Context Diagram (Textual)

1. The radiologist uses the UI for DICOM viewing and report authoring.
2. The UI loads studies via DICOMweb (Orthanc).
3. Dictation is forwarded to the ASR service.
4. Findings and impression are enriched by the inference pipeline.
5. QA checks verify completeness and guideline adherence.
6. Finalization enables DICOM SR export and writes audit logs.

## Non-Goals

- No automatic sign-off without human oversight.
- No storage of PHI in client-side logs.
