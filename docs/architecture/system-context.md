# Systemkontext

## Akteure

- Radiologe/Radiologin (Befunderstellung und Freigabe)
- PACS / DICOM Quelle (Bilddaten)
- Orthanc (DICOM Routing + DICOMweb)
- FastAPI Orchestrator (Workflow und Audit)
- ASR/Inference Worker (MedASR, MedGemma)
- Compliance Repository (Audit Logs, EU AI Act)

## Kontextdiagramm (Textuell)

1. Radiologe nutzt UI fuer DICOM-Viewer und Report.
2. UI laedt Studien via DICOMweb (Orthanc).
3. Diktat wird an ASR Service uebergeben.
4. Findings/Impression werden durch Inference Pipeline angereichert.
5. QA Checks pruefen Vollstaendigkeit/Guidelines.
6. Finalisierung erzeugt DICOM SR und Audit Logs.

## Nicht-Ziele

- Keine automatische Freigabe ohne menschliche Oversight.
- Keine Speicherung von PHI in Client-Logs.
