# Data Flow

## Reporting Workflow (Target)

1. **Queue Selection**: The radiologist selects a study.
2. **DICOM Load**: The viewer loads the DICOMweb stack from Orthanc.
3. **ASR Dictation**: Audio -> ASR -> findings text.
4. **AI Draft**: MedGemma generates an impression using image inputs (current + prior series, optional).
5. **QA Checks**: Completeness, guideline adherence, plausibility.
6. **Review**: The radiologist edits and approves.
7. **Finalize**: DICOM SR export (JSON/binary) becomes available.
8. **Audit**: All steps are written to the audit log.

## Data Formats

- DICOM (image data)
- JSON (report, QA, audit)
- DICOM SR (draft export: JSON + binary)
- Image URLs / local image paths for multimodal inference (rendered PNG frames)
- Image refs (study/series/frame metadata, role=current|prior)
- Evidence indices (back-references to the image manifest)

## Error Handling

- Inference down -> fallback UI: manual editing
- DICOM load failure -> retry or alternative source
