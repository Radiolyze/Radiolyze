# MedGemma 1.5 Nutzung im Projekt (Bestandsaufnahme)

## Ziel und Abgrenzung
- Fokus: Nutzung der MedGemma-1.5-Faehigkeiten im bestehenden Produkt.
- Kein Fine-Tuning: Es geht nur um aktuelle Laufzeitnutzung und um Datenerhebung fuer spaetere Auswertungen.

## Methodik und Quellen im Repo
- Laufzeit-Inferenz: `backend/app/inference_clients.py`, `backend/app/api/inference.py`, `backend/app/tasks.py`
- Bildquellen und Auswahl: `src/hooks/useDicomSeriesInstances.ts`, `src/hooks/reporting/inferenceHelpers.ts`, `src/hooks/useReport.ts`
- Deployment: `docker-compose.yml`
- Viewer und Vergleich: `docs/components/viewer.md`, `src/components/Viewer/*`, `src/hooks/usePriorStudies.ts`
- Annotationen/Datenerhebung: `backend/app/api/annotations.py`, `backend/app/api/training.py`, `src/types/annotations.ts`
- Audit/Compliance: `docs/compliance/audit-logging.md`, `backend/app/audit.py`

## Kurzfazit
Das Projekt nutzt MedGemma 1.5 heute primaer fuer multimodale Bild-Text-Inferenz
(Impression/Summary) auf Basis von 2D gerenderten DICOM-Frames. Es gibt bereits
eine Infrastruktur fuer Current/Prior-Bilder und Evidence-Indices. Die UI kann
3D-Volumen anzeigen (MPR/VRT), aber die Inferenz verarbeitet aktuell nur eine
Auswahl einzelner Frames. WSI/Pathologie, echte volumetrische Inputs,
strukturierte longitudinale Messungen und EHR-Dokumente sind nicht angebunden.
Die Datenerhebung ist solide fuer 2D-Annotationen und Audit-Trails, aber
unvollstaendig fuer 3D- und Longitudinal-Analysen.

## Abgleich: MedGemma-1.5-Faehigkeiten vs. Implementierung

| Faehigkeit | Status | Umsetzung im Projekt | Hinweise |
| --- | --- | --- | --- |
| Multimodal (Text + Bilder) | genutzt | vLLM Chat-Completion mit `image_url` Content; Prompts fuer Summary/Impression | `backend/app/inference_clients.py` |
| Multi-Frame/Serien-Input | teilweise | Auswahl von Frames pro Serie (Sampling/Limit) | `src/hooks/reporting/inferenceHelpers.ts` |
| Longitudinal (Current + Prior) | teilweise | Prior-Studien + `role=current|prior` in ImageRefs; Vergleichsviewer | `src/hooks/usePriorStudies.ts`, `src/pages/ReportWorkspace.tsx` |
| 3D Volumenanalyse | teilweise (UI only) | MPR/VRT Viewer vorhanden, aber Inferenz nutzt 2D Frames | `docs/components/viewer.md`, `src/hooks/useDicomSeriesInstances.ts` |
| Anatomische Lokalisierung/Detektion | teilweise (Datensammlung) | 2D Bounding-Boxes + Labels erfasst; nicht im Inferenz-Output genutzt | `backend/app/api/annotations.py`, `backend/app/api/training.py` |
| Evidence/Provenienz | genutzt | Evidence-Indices werden aus Modellantwort extrahiert und im UI referenziert | `backend/app/inference_clients.py`, `src/components/RightPanel/ImpressionPanel.tsx` |
| WSI/Pathologie | nicht | Keine WSI-Pipeline, keine Tile-Verarbeitung | - |
| Klinische Dokumente/EHR | nicht | Keine EHR-Importe; nur Report-Text im System | - |
| Speech (MedASR) | genutzt | ASR Service via vLLM; UI nimmt Diktat auf | `backend/app/inference_clients.py`, `src/hooks/useASR.ts` |

## Ergaenzung: 3D-Daten und MedGemma-Inputformat

### Chat/Multimodal Format (Ist im Projekt)
- vLLM nutzt ein OpenAI-kompatibles Chat-Format mit multimodalem `content`.
- Das Projekt sendet `image_url` Eintraege (WADO-RS URLs oder base64 Data-URLs).
- Keine direkte Uebergabe von DICOM/NIfTI; alles laeuft ueber gerenderte 2D-Bilder.
- Referenzen: `backend/app/inference_clients.py` (`_build_multimodal_content`, `_encode_image_path`).

### 3D-Volumen (CT/MR) - MedGemma 1.5
- Native 3D-Unterstuetzung setzt Preprocessing auf Slice-Sequenzen voraus.
- Typische Schritte: Laden (DICOM/NIfTI) -> Normalisieren/Resampling -> Slices -> 896x896 -> Liste von Bildern.
- Anzahl Slices durch Kontextbudget limitiert; Auswahlstrategie ist entscheidend.

### Ist-Stand im Projekt (Konsequenzen)
- Die Pipeline entspricht dem Slice-Ansatz (WADO-RS Render Frames), aber:
  - Slice-Auswahl wird stark reduziert (Sampling/Frame-Limits).
  - Preprocessing-Details (Window/Level, HU-Skalierung, Resampling) werden nicht persistiert.
  - vLLM Kontextlimit ist aktuell auf `--max-model-len 4096` gesetzt; `VLLM_MAX_TOKENS` default 512.
- Referenzen: `docker-compose.yml`, `src/hooks/reporting/inferenceHelpers.ts`.

### Im Datenerhebungs-Setup fehlen 3D-Parameter
- SliceThickness, PixelSpacing, ImageOrientation, SpacingBetweenSlices.
- Slice-Reihenfolge und Auswahlstrategie (z.B. uniform sampling vs. key slices).
- Rendering-Parameter (Window/Level Preset, VOI).

## Datenerhebung heute (ohne Fine-Tuning)

### Was bereits erfasst wird
- DICOM-Frame-Referenzen: Study/Series/Instance/Frame, WADO-URL, optional StudyDate/Modality/Role.
- Reports: Findings/Impression, QA-Status, QA-Warnungen.
- Inferenz-Metadaten: Model-Version, Input-Hash, Output-Summary, Evidence-Indices.
- Annotationen: 2D-Geometrie (Bounding Box/Handles), Labels, Kategorie, Schweregrad, Laterality, Region.
- Audit-Events: Ereignis-Typ, Actor, Zeitstempel, Metadaten, Quelle.

### Wo gespeichert/exportiert
- DB Tabellen: `reports`, `inference_jobs`, `annotations`, `audit_events`.
- Export: COCO/HuggingFace/MedGemma JSON (ohne Bilder; Images ueber WADO-RS nachziehbar).

## Luecken in der Datenerhebung (aus Sicht der MedGemma-1.5-Faehigkeiten)
1. Volumetrischer Kontext fehlt in der Inferenz:
   - Es werden nur gerenderte 2D-Frames gesendet, keine Volumenstruktur (Slice-Spacing, Orientation, Pixel-Spacing).
   - Frame-Sampling reduziert 3D-Kontext weiter.
2. Longitudinaler Kontext ist minimal:
   - Role=current/prior vorhanden, aber kein Zeitabstand, keine registrierte Zuordnung, keine quantitativen Verlaufsdaten.
3. Lokalisierung ist nicht mit Inferenz verbunden:
   - Annotationen existieren, aber Inferenz liefert keine Bounding-Boxes/Segmentierungen fuer UI-Evidence.
4. Pathologie/WSI und andere Modalitaeten:
   - Kein Tile/WSI-Handling, keine Dermatologie/Ophthalmologie Inputs.
5. Text- und Struktur-Labels:
   - Findings/Impression sind Freitext; keine normalisierten Ontologien (RadLex, SNOMED).
   - ASR-Transkripte werden nicht serverseitig persistiert (Audit nur Hash/Laenge).

## Empfohlene Datenerhebung (ohne Fine-Tuning)

### 1) Volumen- und Serien-Metadaten
- `ImageRef` um SliceThickness, PixelSpacing, ImageOrientation, SeriesInstanceUID erweitern.
- Reihenfolge/Spacing pro Serie speichern (damit Volumen rekonstruiert werden kann).
- Im Inferenz-Job die tatsaechlich gesendeten Frames (IDs + Reihenfolge) persistieren.

### 2) Longitudinaler Kontext
- `time_delta_days` zwischen current/prior persistieren.
- Genutzte Prior-Serie speichern (Serien-ID + Datum + Modality).
- Optional: manuelle Vergleichsnotiz oder simple Messwerte (z.B. Laesionsgroesse).

### 3) Evidence und Lokalisierung
- Evidence optional auf Bounding-Boxes/Segmentierungen erweitern (auch wenn nur menschlich annotiert).
- Evidence mit Annotationen verknuepfen (gleiche Frame-ID + ROI).

### 4) Text-Labels und Struktur
- Strukturierte Labels erfassen (z.B. "no finding" vs. "finding", Organ/Region, Laterality).
- Prompt-Versionen und System-Prompt-Hash bei Inferenz speichern (Evaluation).

### 5) Bilddaten fuer Re-Use
- Optional einen "Data Capture" Modus:
  - renderte PNGs speichern (kompakt) oder WADO-RS Endpunkte referenzieren.
  - Datenkatalog (Study/Series/Frame) fuer spaetere Evaluation.

## Priorisierte naechste Schritte (Datensammlung)
1. ImageRef- und Serien-Metadaten erweitern (volumetrischer Kontext).
2. Longitudinale Metadaten (time delta + prior mapping) persistieren.
3. Evidence-Indices versionieren und mit Annotationen verknuepfen.
4. Exportstatistiken erweitern (pro Modality, pro Series, pro Label).
5. Optional: Data Capture Modus fuer gespeicherte Renderings.

## Erweiterter Plan: Umfassende Nutzung der MedGemma-1.5-Faehigkeiten

### P0: 3D-Readiness in der Inferenzpipeline
- Volumen-Slices mit konsistenter Reihenfolge und Spacing erfassen.
- Sampling-Strategien pro Modality (CT/MR) definieren und dokumentieren.
- Rendering-Parameter (VOI/WL Preset) persistieren.
- vLLM Kontextbudget pruefen und ggf. anpassen (max-model-len, max_tokens).

### P1: Longitudinaler Kontext als First-Class Input
- Explizite current/prior Paare mit Zeitabstand in der Inferenz-Queue speichern.
- Optional: einfache Vergleichsmetriken (z.B. Laesion groesse, ROI-Messung).
- Vergleichs-Prompts standardisieren (Change/Trend-Formulierungen).

### P1: Strukturierte Outputs und Validierung
- JSON-Outputs mit Schema-Validierung erzwingen (Summary/Impression/Findings).
- Evidence-Indices verpflichtend machen (wenn Bilder genutzt werden).
- Prompt-Version und Prompt-Fingerprint in Audit/Inferenz speichern.

### P2: WSI und Patch-Workflows (optional, aber "Model Capabilities" decken)
- Tile/patch Manifest definieren (Index, Koordinaten, Magnification).
- Batch-Inputs fuer WSI (gepoolte Patches mit Role/Region).
- Annotation-Export auf WSI-Tiles erweitern.

### P2: Wissens- und Textverstehen besser nutzen
- Report-Templates/GUIDELINES als Kontext in Prompts einspeisen.
- Strukturierte Extraktion (z.B. JSON fuer Findings) als eigenen Endpoint anbieten.

### P3: Evaluation und Reproduzierbarkeit
- Golden Sets fuer CT/MR/longitudinal definieren (ohne Training).
- Replay-Mechanismus fuer Inferenz mit gleichem Slice-Set.
- Qualitaetsberichte (Coverage, Missing Metadata, Drift Indikatoren).
