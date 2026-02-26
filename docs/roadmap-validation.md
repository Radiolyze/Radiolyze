# Roadmap-Validierung: Stand vs. Code

**Datum:** 2025-02-26  
**Branch:** cursor/roadmap-code-abgleich-e514

## Zusammenfassung

Die Roadmap (`docs/roadmap.md`) beschreibt die nächsten Schritte im Sprint "MedGemma Overlay (Proposals 3-5)". Die Validierung gegen den aktuellen Code zeigt: **alle drei sofort umsetzbaren Punkte sind noch offen**.

---

## Naechste Schritte (Sprint) – Validierung

### 1. Index.tsx Verdrahtung: `report.inferenceFindings` → DicomViewer

**Roadmap:** `report.inferenceFindings` als `findings`-Prop an `<DicomViewer>` weiterreichen.

**Status:** ❌ **Nicht umgesetzt**

**Befund:**
- `Index.tsx` rendert nur `<ReportWorkspace />` – die eigentliche Verdrahtung liegt in `ReportWorkspace.tsx`.
- `ReportWorkspace` nutzt `useReport()` und erhält `report` mit `inferenceFindings` (wird bei `generateImpression`/`analyzeImages` gesetzt).
- `ComparisonViewer` erhält **keine** `findings`- oder `inferenceFindings`-Prop.
- `ComparisonSingleView` und `ComparisonPane` rufen `<DicomViewer>` auf – **ohne** `findings`-Prop.
- `DicomViewer` hat bereits die Prop `findings?: FindingBox[]` und rendert `<AIFindingsOverlay findings={findings} />` – die Infrastruktur ist da, die Daten kommen nur nicht an.

**Datenfluss (aktuell):**
```
ReportWorkspace (report.inferenceFindings vorhanden)
  → ComparisonViewer (findings nicht übergeben)
    → ComparisonSingleView / ComparisonPane
      → DicomViewer (findings = [] Default)
```

**Erforderliche Änderung:**
- `findings` durch die Kette durchreichen: ReportWorkspace → ComparisonViewer → ComparisonSingleView/ComparisonPane → DicomViewer.
- `report?.inferenceFindings ?? []` als Prop übergeben.

---

### 2. On-Demand Frame-Lokalisierung: `POST /api/v1/inference/localize`

**Roadmap:** Backend-Endpunkt für einzelnen Frame (Job-Queue, schnelles Polling).

**Status:** ✅ **Umsetzt** (Proposal 2)

**Befund:**
- `POST /api/v1/inference/localize` mit `LocalizeRequest` (report_id, study_id, image_ref)
- `run_localize_job` Task in tasks.py, `generate_localize_findings` in inference_clients
- Frontend: `inferenceClient.queueLocalize(payload)` in inferenceClient.ts
- Polling via bestehenden `GET /api/v1/inference/status/{job_id}` (result.findings)

---

### 3. "Frame analysieren"-Button in DicomViewer-Toolbar

**Roadmap:** Aktuellen Frame an Lokalisierungs-Endpoint senden, Findings im Overlay anzeigen.

**Status:** ❌ **Nicht umgesetzt**

**Befund:**
- `DicomViewerToolbar` hat:
  - ImageControls (Tools)
  - Annotation-Mode-Toggle
  - Window/Level-Presets
  - KI-Befunde Eye/EyeOff-Toggle (wenn `findingsCount > 0`)
  - Export-Button
- Kein "Frame analysieren"- oder "Lokalisieren"-Button.
- `DicomViewer` hat keinen Callback `onLocalizeFrame` o.ä.

**Erforderliche Änderung:**
- Button in `DicomViewerToolbar` (z.B. "Frame analysieren" / Scan-Icon).
- Callback `onAnalyzeFrame?: (imageRef: ImageRef) => void` in `DicomViewer` und Toolbar.
- Im Callback: `POST /api/v1/inference/localize` mit aktuellem Frame-Ref aufrufen, Job pollen, `inferenceFindings` ins Report-State mergen (oder lokal im Viewer anzeigen).

---

## Phase 4 & 5 – Kurzüberblick

| Item | Roadmap | Code-Stand |
|------|---------|------------|
| Human Oversight Dialog | [~] | Dialog vorhanden, Pflichtfelder/Report-Events nicht durchgängig |
| EU AI Act Annex IV | [~] | Entwurf vorhanden, TODOs offen |
| Drift Monitoring | [~] | API-Report + Snapshot, Scheduling/UI offen |
| Security Hardening | [~] | Baseline-Doku, AuthN/AuthZ/TLS/Rate Limits offen |
| DICOM SR Export | [~] | JSON + Binary + UI, Archivierung offen |
| Templates + Guidelines RAG | [ ] | Nicht begonnen |
| DICOM → Image Pipeline | [ ] | Nicht begonnen |
| Observability | [~] | Metrics + Drift-Report, Tracing offen |

---

## Phase 5.5 MedGemma – Weitere offene Punkte

| Item | Status |
|------|--------|
| Index.tsx Verdrahtung | ❌ Offen |
| On-Demand Frame-Lokalisierung API | ❌ Offen |
| "Frame analysieren"-Button | ❌ Offen |
| 3D-Readiness | ❌ Offen |
| Longitudinal Context | ❌ Offen |
| Strukturierte Outputs (JSON Schema) | ❌ Offen |
| Evidence-Indices verpflichtend | ❌ Offen |
| WSI/Patch Manifest | ❌ Offen |
| Data Capture Modus | ❌ Offen |

---

## Empfohlene Reihenfolge der Umsetzung

1. **Proposal 1 (Verdrahtung)** – Kleine Änderung, sofort sichtbarer Nutzen: Overlay zeigt vorhandene `inferenceFindings`.
2. **Proposal 2 (Backend localize)** – Voraussetzung für Proposal 3.
3. **Proposal 3 (Frame analysieren-Button)** – Nutzt Proposal 1+2, rundet die Feature-Kette ab.

---

## Abhängigkeiten

- **Proposal 1** ist unabhängig und kann sofort umgesetzt werden.
- **Proposal 2** benötigt ggf. Anpassungen in `inference_clients.py` und `tasks.py` für einen separaten Lokalisierungs-Prompt/Task.
- **Proposal 3** setzt Proposal 2 voraus (oder einen Mock für Tests).
