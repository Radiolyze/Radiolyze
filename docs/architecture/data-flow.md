# Datenfluss

## Befund-Workflow (Soll)

1. **Queue Auswahl**: Radiologe waehlt Study.
2. **DICOM Load**: Viewer laedt DICOMweb-Stack aus Orthanc.
3. **ASR Diktat**: Audio -> ASR -> Findings Text.
4. **AI Draft**: MedGemma + LLM erzeugen Impression (optional mit Bild-Inputs).
5. **QA Checks**: Vollstaendigkeit, Guidelines, Plausibilitaet.
6. **Review**: Radiologe korrigiert und freigibt.
7. **Finalize**: DICOM SR Export (JSON/Binary) ist verfuegbar.
8. **Audit**: Alle Schritte werden in Audit Log geschrieben.

## Datenformate

- DICOM (Bilddaten)
- JSON (Report, QA, Audit)
- DICOM SR (Draft Export: JSON + Binary)
- Image URLs / lokale Bildpfade fuer Multimodal Inference

## Fehlerfall

- Inference Down -> Fallback UI: manuelle Bearbeitung
- DICOM Load Failure -> Retry oder alternative Quelle
