# Gap-Analyse & Umsetzungsplan

**Erstellt:** 2026-04-25  
**Branch:** claude/audit-project-roadmap-SiT4l  
**Methode:** Vollständiger Code-Abgleich gegen `docs/roadmap.md`

---

## Zusammenfassung

Phase 1–3.5 sowie weite Teile von Phase 5.5 sind vollständig umgesetzt. Die
wesentlichen Lücken konzentrieren sich auf vier Bereiche: operativer Betrieb
des Drift-Monitorings (kein Scheduler), echtes RAG statt LIKE-Suche,
Vervollständigung der Compliance-Dokumentation sowie kleinere 3D/Longitudinal-
und Tracing-Features.

| Phase | Roadmap-Status | Realer Stand |
|-------|---------------|--------------|
| 1 – UI MVP | ✅ | ✅ vollständig |
| 2 – Backend Orchestrator | ✅ | ✅ vollständig |
| 3 – Vergleichsmodus | ✅ | ✅ vollständig |
| 3.5 – Maintenance | ✅ | ✅ vollständig |
| 4 – Compliance Ready | [~] | ⚠️ 3 Lücken |
| 5 – Production | [~]/[ ] | ⚠️ 3 Lücken |
| 5.5 – MedGemma | [x]/[ ] | ⚠️ 5 Lücken |
| 6 – Scale & Optimization | [ ] | ❌ nicht begonnen |

---

## Identifizierte Gaps (priorisiert)

### P1 – Kritisch (blockiert Compliance / Produktion)

#### GAP-01: Drift-Monitoring Scheduler fehlt
**Roadmap:** Phase 4 `[~]` – "Scheduling/UI offen"  
**Befund:** `GET /api/v1/monitoring/drift` und UI (`src/pages/Monitoring.tsx`) sind
vollständig implementiert. Es fehlt jedoch ein periodischer Aufruf. Kein
APScheduler, kein RQ-scheduled-Job, kein Cron-Entry in `docker-compose.yml`.  
**Auswirkung:** Drift-Alerts werden nie automatisch ausgelöst; Post-Market
Monitoring (Art. 72 EU AI Act) ist nicht operativ.  
**Betroffene Dateien:**
- `backend/app/main.py` – kein `lifespan`-Scheduler-Start
- `docker-compose.yml` – kein Worker-Eintrag für Scheduler
- `backend/app/api/monitoring.py` – Drift-Endpunkt vorhanden, aber passiv

---

#### GAP-02: Templates/Guidelines – kein echtes RAG
**Roadmap:** Phase 5 `[ ]` – "Templates + Guidelines RAG"  
**Befund:** `GET /api/v1/guidelines/search` verwendet PostgreSQL `ILIKE`
(LIKE-Suche). Kein pgvector, keine Embeddings, kein Retrieval-Augmented-
Generation-Flow. `backend/app/api/guidelines.py` enthält expliziten Kommentar:
*"upgrading to tsvector / pgvector is a transparent data-layer change"*.  
**Auswirkung:** Guideline-Retrieval findet nur exakte Wortübereinstimmungen;
semantisch ähnliche Texte werden nicht gefunden.  
**Betroffene Dateien:**
- `backend/app/api/guidelines.py` (Zeile 6, 54–82)
- `backend/app/models.py` (Guideline-Modell, Zeile 180)
- `backend/app/api/templates.py` (`populate`-Endpunkt, Zeilen 169–188)

---

#### GAP-03: EU AI Act Annex IV – offene TODOs in Section 15
**Roadmap:** Phase 4 `[~]` – "EU AI Act Dokumentation (Annex IV Entwurf vorhanden, offene TODOs)"  
**Befund:** `docs/compliance/annex-iv.md` Section 15 listet explizit:
- Vollständige Risikoanalyse (FMEA / ISO 14971) fehlt
- Daten-Governance-Dokumentation (Anonymisierung, Training) fehlt
- Vollständige Model Cards inkl. Trainingsdatenquellen fehlen
- KPI/Drift-Dashboards (Metriken-Persistenz für Compliance-Nachweis)

**Auswirkung:** Fehlt für Konformitätserklärung und Notified-Body-Audit.  
**Betroffene Dateien:**
- `docs/compliance/annex-iv.md` (Section 15)
- `docs/compliance/eu-ai-act-mapping.md`

---

### P2 – Wichtig (Phase 5.5-Vollständigkeit)

#### GAP-04: DICOM → JPEG Pipeline – kein serverseitiges Frame-Retrieval
**Roadmap:** Phase 5 `[ ]` – "DICOM → Image Pipeline für Multimodal Inference (WADO-RS/JPEG)"  
**Befund:** Das Frontend baut WADO-RS Rendered-Frame-URLs via
`buildWadorsRenderedFrameUrl` und übergibt sie als `image_urls` an den
Inference-Endpunkt. `backend/app/inference_clients.py` schreibt diese URLs für
den Docker-internen Zugriff um (`_rewrite_image_urls`). **Serverseitiges
Frame-Retrieval** (Backend holt selbst Pixel-Daten via WADO-RS und konvertiert
zu JPEG/PNG) existiert nicht. `dicom_client.py` enthält nur `store_sr()`
(STOW-RS), keinen `retrieve_frame()`-Aufruf.  
**Auswirkung:** Batch-Inference und Worker-Tasks können keine Frames unabhängig
vom Browser abrufen; Robustheit gegen Session-Timeouts fehlt.  
**Betroffene Dateien:**
- `backend/app/dicom_client.py` – `retrieve_frame()` fehlt komplett
- `backend/app/tasks.py` – `run_inference_job` nutzt nur übergebene URLs
- `backend/app/api/inference.py` (Zeilen 119–140)

---

#### GAP-05: Observability – kein Distributed Tracing
**Roadmap:** Phase 5 `[~]` – "Tracing offen"  
**Befund:** `backend/app/main.py` enthält ein einfaches Request-ID-Middleware
(Zeile 79). Kein OpenTelemetry-SDK, kein Jaeger/Zipkin-Export, keine
Span-Instrumentierung in API-Routen oder Worker-Tasks.  
**Auswirkung:** Keine Request-übergreifende Korrelation zwischen API, Worker,
DB und vLLM; Debugging in Produktion eingeschränkt.  
**Betroffene Dateien:**
- `backend/app/main.py`
- `backend/requirements.txt` – kein `opentelemetry-*`
- `backend/app/api/inference.py`, `backend/app/tasks.py`

---

#### GAP-06: Evidence-Indices nicht verpflichtend bei Bild-Inputs
**Roadmap:** Phase 5.5 `[ ]` – "Evidence-Indices verpflichtend bei Bild-Inputs"  
**Befund:** In `backend/app/ai_schemas.py` ist `evidence_indices` als
`list[int] | None = Field(default=None, ...)` definiert (Zeilen 48–50, 117–119).
Es existiert keine Validierungslogik, die `evidence_indices` bei Bild-Inputs
(`image_urls`/`image_paths` vorhanden) als Pflichtfeld erzwingt.  
**Auswirkung:** Modell-Outputs ohne Bildnachweis-Referenz landen in der DB;
Traceability-Anforderung aus EU AI Act Art. 12 potenziell verletzt.  
**Betroffene Dateien:**
- `backend/app/ai_schemas.py` (Zeilen 48–50, 117–119, Validatoren Zeilen 63+, 136+)
- `backend/app/utils/inference.py`

---

#### GAP-07: 3D-Readiness – Slice-Sortierung nur nach InstanceNumber
**Roadmap:** Phase 5.5 `[ ]` – "3D-Readiness: Slice-Order, Spacing, VOI/WL Persistenz"  
**Befund:**
- **Slice-Order:** `useDicomSeriesInstances.ts` (Zeile 147) sortiert ausschließlich
  nach `InstanceNumber`. Für korrekte 3D-Rekonstruktion müsste nach
  `ImagePositionPatient[2]` (z-Koordinate) oder `SliceLocation` sortiert werden.
- **Spacing:** `spacingBetweenSlices` wird korrekt aus Tag `00180088` gelesen
  und an `image_refs` weitergegeben ✅
- **VOI/WL Persistenz:** `useViewportSync.ts` synchronisiert `windowLevel` im
  Arbeitsspeicher (in-memory). Keine Persistenz in DB oder localStorage zwischen
  Sessions.

**Betroffene Dateien:**
- `src/hooks/useDicomSeriesInstances.ts` (Zeilen 147–153) – kein SliceLocation-Fallback
- `src/hooks/useViewportSync.ts` – kein Persist-Layer
- `src/hooks/useUserPreferences.ts` – kein WL-Eintrag

---

#### GAP-08: Longitudinal Context – keine DB-Persistenz der Current/Prior-Paare
**Roadmap:** Phase 5.5 `[ ]` – "Longitudinal Context: Current/Prior Paare + Time-Delta"  
**Befund:** `time_delta_days` ist in `backend/app/schemas.py` (Zeile 142) und
`inference_clients.py` (Zeile 153) als Feld in `image_refs` vorhanden und wird
korrekt in den Prompt-Text eingebettet. Es gibt jedoch keine DB-Tabelle und
keinen API-Endpunkt zur Persistenz von "Current-Study ↔ Prior-Study"-Paaren mit
zugehörigem Time-Delta. Der Wert wird nur pro-Request übergeben, nicht dauerhaft
gespeichert.  
**Betroffene Dateien:**
- `backend/app/models.py` – kein `LongitudinalPair`-Modell
- `backend/app/api/inference.py` – kein Persistenz-Step nach Localize/Inference
- `src/hooks/usePriorStudies.ts`, `src/hooks/usePriorReports.ts`

---

### P3 – Niedrig (Phase 5.5 Erweiterungen / Phase 6)

#### GAP-09: WSI/Patch Manifest – nicht begonnen
**Roadmap:** Phase 5.5 `[ ]` – "Optional: WSI/Patch Manifest + Tile Inputs"  
**Befund:** Kein Backend-Endpunkt, kein Frontend-Component.  

---

#### GAP-10: Data Capture Modus – nicht begonnen
**Roadmap:** Phase 5.5 `[ ]` – "Data Capture Modus (Rendered PNG + Manifest)"  
**Befund:** Kein Capture-Service, kein UI-Trigger.

---

#### GAP-11: TLS-Terminierung im Docker-Compose-Stack
**Roadmap:** Phase 4 `[~]` – "Security Hardening (TLS offen)"  
**Befund:** `docker/nginx.conf` und Dockerfile.frontend existieren. Kein
Let's-Encrypt/cert-manager-Setup, keine TLS-Config in `docker-compose.yml`.  
**Betroffene Dateien:**
- `docker/nginx.conf`
- `docker-compose.yml`

---

## Umsetzungsplan

### Sprint A – Compliance & Monitoring (Woche 1–2)

| # | Aufgabe | Dateien | Aufwand |
|---|---------|---------|---------|
| A1 | Drift-Scheduler via APScheduler in FastAPI-`lifespan` | `backend/app/main.py`, `requirements.txt` | S |
| A2 | Annex IV Section 15 ausfüllen: FMEA-Template, Data-Governance-Outline | `docs/compliance/annex-iv.md` | M |
| A3 | Model Card Template erstellen (MedGemma 1.5 + vLLM) | `docs/compliance/model-card-medgemma.md` (neu) | S |

**A1-Detail:** APScheduler (`BackgroundScheduler`) starten im `lifespan`-Context-Manager
von `main.py`. Job ruft `GET /api/v1/monitoring/drift?persist=true` intern auf
(oder direkt die Service-Funktion). Intervall per `DRIFT_SCHEDULE_HOURS` (Default: 24).

---

### Sprint B – RAG-Pipeline (Woche 2–4)

| # | Aufgabe | Dateien | Aufwand |
|---|---------|---------|---------|
| B1 | pgvector-Extension + `embedding`-Kolumne in Guideline-Modell | `backend/app/models.py`, Alembic-Migration | M |
| B2 | Embedding-Worker: Text → OpenAI/local-Embedding → DB | `backend/app/api/guidelines.py`, `backend/app/tasks.py` | M |
| B3 | Semantic-Search-Endpunkt (`/api/v1/guidelines/semantic-search`) | `backend/app/api/guidelines.py` | S |
| B4 | Frontend: GuidelinesPanel auf semantische Suche umstellen | `src/components/RightPanel/GuidelinesPanel.tsx`, `src/services/guidelinesClient.ts` | S |

**B1-Detail:** `pgvector`-Extension per `CREATE EXTENSION IF NOT EXISTS vector` in
Migration. `Guideline`-Modell bekommt `embedding: Vector(1536) | None`. LIKE-Suche
bleibt als Fallback erhalten.

---

### Sprint C – DICOM→JPEG Pipeline (Woche 3–5)

| # | Aufgabe | Dateien | Aufwand |
|---|---------|---------|---------|
| C1 | `retrieve_rendered_frame(study, series, instance, frame)` in `dicom_client.py` | `backend/app/dicom_client.py` | S |
| C2 | Worker-Task `run_inference_job` nutzt `retrieve_rendered_frame` wenn keine `image_urls` | `backend/app/tasks.py` | S |
| C3 | Caching (TTL 5 min) für retrievte Frames (Redis) | `backend/app/tasks.py`, `backend/app/queue.py` | S |

**C1-Detail:** WADO-RS Rendered-Endpunkt:
`GET {base_url}/studies/{study}/series/{series}/instances/{sop}/frames/{n}/rendered`
mit `Accept: image/jpeg`. Rückgabe als `bytes`. Auth via `_orthanc_auth()`.

---

### Sprint D – Evidence-Indices + 3D-Readiness (Woche 4–5)

| # | Aufgabe | Dateien | Aufwand |
|---|---------|---------|---------|
| D1 | Validator in `ai_schemas.py`: `evidence_indices` Pflicht wenn `image_refs` nicht leer | `backend/app/ai_schemas.py` | XS |
| D2 | Slice-Sortierung nach `ImagePositionPatient[2]` / `SliceLocation` als primäres Kriterium | `src/hooks/useDicomSeriesInstances.ts` | S |
| D3 | VOI/WL in `useUserPreferences.ts` persistieren (localStorage + API) | `src/hooks/useUserPreferences.ts`, `src/hooks/useViewportSync.ts` | S |

**D1-Detail:**
```python
@model_validator(mode="after")
def require_evidence_when_images(self) -> "ImpressionOutput":
    if self.image_refs and not self.evidence_indices:
        raise ValueError("evidence_indices required when image_refs are present")
    return self
```

---

### Sprint E – Longitudinal Context Persistenz (Woche 5–6)

| # | Aufgabe | Dateien | Aufwand |
|---|---------|---------|---------|
| E1 | DB-Modell `ReportComparison` (current_report_id, prior_study_id, time_delta_days) | `backend/app/models.py`, Migration | S |
| E2 | API: `POST /api/v1/reports/{id}/comparisons` + `GET` | `backend/app/api/reports.py` | S |
| E3 | Frontend: Prior-Auswahl persistiert Comparison-Record | `src/hooks/usePriorStudies.ts` | S |

---

### Sprint F – Observability / Tracing (Woche 6–8)

| # | Aufgabe | Dateien | Aufwand |
|---|---------|---------|---------|
| F1 | OpenTelemetry SDK + FastAPI-Instrumentation | `backend/requirements.txt`, `backend/app/main.py` | S |
| F2 | Jaeger-Service in `docker-compose.yml` | `docker-compose.yml` | XS |
| F3 | Span-Instrumentation in Inference-Endpunkt + Worker-Task | `backend/app/api/inference.py`, `backend/app/tasks.py` | M |

---

### Sprint G – TLS & Security Hardening (Woche 7–8)

| # | Aufgabe | Dateien | Aufwand |
|---|---------|---------|---------|
| G1 | Self-signed / Let's-Encrypt TLS in nginx.conf | `docker/nginx.conf`, `docker-compose.yml` | S |
| G2 | `env.example` mit TLS-Vars ergänzen | `env.example` | XS |

---

## Priorisierte Reihenfolge

```
Sprint A (Compliance) → parallel zu Sprint B (RAG)
Sprint C (DICOM Pipeline)
Sprint D (Evidence + 3D)
Sprint E (Longitudinal)
Sprint F (Tracing) → parallel zu Sprint G (TLS)
```

GAP-09 (WSI) und GAP-10 (Data Capture) werden nach Sprint E bewertet und ggf.
auf Phase 6 verschoben.

---

## Aufwandsschätzung (T-Shirt Sizes)

| Size | Aufwand |
|------|---------|
| XS | < 1h |
| S | 0.5–1 Tag |
| M | 2–3 Tage |

Gesamtaufwand Sprints A–G: **~18–22 Personentage**

---

## Abhängigkeiten

- **B1 → B2 → B3 → B4** (pgvector muss vor Embedding-Worker laufen)
- **C1 → C2** (retrieve_frame Prerequisite für Worker)
- **D1** ist unabhängig (XS, sofort umsetzbar)
- **E1 → E2 → E3**
- **F1 → F2 → F3**
- Sprint A hat keine Abhängigkeiten, sofort startbar
