# Gap-Analyse & Umsetzungsplan

**Erstellt:** 2026-04-25  
**Aktualisiert:** 2026-04-25  
**Branch:** claude/audit-roadmap-gaps-Zf7l7  
**Methode:** Vollständiger Code-Abgleich gegen `docs/roadmap.md`

---

## Zusammenfassung

Phase 1–3.5 sowie weite Teile von Phase 5.5 sind vollständig umgesetzt. GAP-01
(Drift-Scheduler) wurde in Commit `45d7437` behoben. Die verbleibenden Lücken
konzentrieren sich auf vier Bereiche: echtes RAG statt LIKE-Suche,
Vervollständigung der Compliance-Dokumentation, fehlende Backend-Infrastruktur
(DICOM-Frame-Retrieval, Tracing, Longitudinal-Context-Persistenz) sowie kleinere
Schema-Validierungen und 3D-Features.

| Phase | Roadmap-Status | Realer Stand |
|-------|---------------|--------------|
| 1 – UI MVP | ✅ | ✅ vollständig |
| 2 – Backend Orchestrator | ✅ | ✅ vollständig |
| 3 – Vergleichsmodus | ✅ | ✅ vollständig |
| 3.5 – Maintenance | ✅ | ✅ vollständig |
| 4 – Compliance Ready | [~] | ⚠️ 2 Lücken (GAP-03, GAP-11) |
| 5 – Production | [~]/[ ] | ⚠️ 3 Lücken (GAP-02, GAP-04, GAP-05) |
| 5.5 – MedGemma | [x]/[ ] | ⚠️ 3 Lücken (GAP-06, GAP-07, GAP-08) |
| 6 – Scale & Optimization | [ ] | ❌ nicht begonnen |

---

## Gelöste Gaps

### ~~GAP-01: Drift-Monitoring Scheduler~~ ✅ Behoben (Commit `45d7437`)

APScheduler (`BackgroundScheduler`) läuft seit Commit `45d7437` im `on_startup`-
Handler von `backend/app/main.py`. Intervall wird per `DRIFT_SCHEDULE_HOURS`
(Default: 24 h) konfiguriert; `DRIFT_SCHEDULE_HOURS=0` deaktiviert den Scheduler
explizit.

---

## Offene Gaps (priorisiert)

### P1 – Kritisch (blockiert Compliance / Produktion)

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
- `backend/app/models.py` (`Guideline`-Modell, Zeile 180)
- `backend/app/api/templates.py` (`populate`-Endpunkt)

---

#### GAP-03: EU AI Act Annex IV – offene TODOs in Section 15
**Roadmap:** Phase 4 `[~]` – "EU AI Act Dokumentation (Annex IV Entwurf vorhanden, offene TODOs)"  
**Befund:** `docs/compliance/annex-iv.md` Section 15 listet explizit:
- Vollständige Risikoanalyse (FMEA / ISO 14971) fehlt
- Daten-Governance-Dokumentation (Anonymisierung, Training) fehlt
- Vollständige Model Cards inkl. Trainingsdatenquellen fehlen
- KPI/Drift-Dashboards (Metriken-Persistenz für Compliance-Nachweis)
- RBAC-Implementierung und Auth-Provider-Auswahl

**Auswirkung:** Fehlt für Konformitätserklärung und Notified-Body-Audit.  
**Betroffene Dateien:**
- `docs/compliance/annex-iv.md` (Section 15)
- `docs/compliance/eu-ai-act-mapping.md`

---

### P2 – Wichtig (Phase 5/5.5-Vollständigkeit)

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
(Zeile 82). Kein OpenTelemetry-SDK, kein Jaeger/Zipkin-Export, keine
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
(`image_urls`/`image_refs` vorhanden) als Pflichtfeld erzwingt.  
**Auswirkung:** Modell-Outputs ohne Bildnachweis-Referenz landen in der DB;
Traceability-Anforderung aus EU AI Act Art. 12 potenziell verletzt.  
**Betroffene Dateien:**
- `backend/app/ai_schemas.py` (Zeilen 48–50, 117–119)
- `backend/app/utils/inference.py`

---

#### GAP-07: 3D-Readiness – Slice-Sortierung nur nach InstanceNumber
**Roadmap:** Phase 5.5 `[ ]` – "3D-Readiness: Slice-Order, Spacing, VOI/WL Persistenz"  
**Befund:**
- **Slice-Order:** `useDicomSeriesInstances.ts` (Zeile 147) sortiert ausschließlich
  nach `InstanceNumber`. Für korrekte 3D-Rekonstruktion müsste nach
  `ImagePositionPatient[2]` (z-Koordinate) oder `SliceLocation` sortiert werden.
- **Spacing:** `spacingBetweenSlices` wird korrekt aus Tag `00180088` gelesen ✅
- **VOI/WL Persistenz:** `useViewportSync.ts` synchronisiert `windowLevel` im
  Arbeitsspeicher (in-memory). Keine Persistenz in DB oder localStorage zwischen
  Sessions.

**Betroffene Dateien:**
- `src/hooks/useDicomSeriesInstances.ts` (Zeilen 147–153)
- `src/hooks/useViewportSync.ts`
- `src/hooks/useUserPreferences.ts`

---

#### GAP-08: Longitudinal Context – keine DB-Persistenz der Current/Prior-Paare
**Roadmap:** Phase 5.5 `[ ]` – "Longitudinal Context: Current/Prior Paare + Time-Delta"  
**Befund:** `time_delta_days` ist in `backend/app/schemas.py` und
`inference_clients.py` als Feld in `image_refs` vorhanden und wird korrekt in
den Prompt-Text eingebettet. Es gibt jedoch keine DB-Tabelle und keinen
API-Endpunkt zur Persistenz von "Current-Study ↔ Prior-Study"-Paaren mit
zugehörigem Time-Delta. Der Wert wird nur pro-Request übergeben, nicht dauerhaft
gespeichert.  
**Betroffene Dateien:**
- `backend/app/models.py` – kein `ReportComparison`-Modell
- `backend/app/api/inference.py` – kein Persistenz-Step nach Localize/Inference
- `src/hooks/usePriorStudies.ts`, `src/hooks/usePriorReports.ts`

---

### P3 – Niedrig (Phase 5.5 Erweiterungen / Phase 6)

#### GAP-09: WSI/Patch Manifest – nicht begonnen
**Roadmap:** Phase 5.5 `[ ]` – "Optional: WSI/Patch Manifest + Tile Inputs"  
**Befund:** Kein Backend-Endpunkt, kein Frontend-Component. Verschoben auf Phase 6.

---

#### GAP-10: Data Capture Modus – nicht begonnen
**Roadmap:** Phase 5.5 `[ ]` – "Data Capture Modus (Rendered PNG + Manifest)"  
**Befund:** Kein Capture-Service, kein UI-Trigger. Verschoben auf Phase 6.

---

#### GAP-11: TLS-Terminierung im Docker-Compose-Stack
**Roadmap:** Phase 4 `[~]` – "Security Hardening (TLS offen)"  
**Befund:** `docker/nginx.conf` und `Dockerfile.frontend` existieren. Kein
Let's-Encrypt/cert-manager-Setup, keine TLS-Config in `docker-compose.yml`.
`ENABLE_HSTS` ist zwar im Code referenziert (`main.py` Zeile 60), aber ohne
aktives TLS wirkungslos.  
**Betroffene Dateien:**
- `docker/nginx.conf`
- `docker-compose.yml`

---

## Umsetzungsplan

### Sprint A – Compliance-Dokumentation (Woche 1–2)

| # | Aufgabe | Dateien | Aufwand |
|---|---------|---------|---------|
| A1 | Annex IV Section 15 ausfüllen: FMEA-Template, Data-Governance-Outline | `docs/compliance/annex-iv.md` | M |
| A2 | Model Card Template erstellen (MedGemma 1.5 + vLLM) | `docs/compliance/model-card-medgemma.md` (neu) | S |
| A3 | eu-ai-act-mapping.md: verbleibende TODO-Zellen ausfüllen | `docs/compliance/eu-ai-act-mapping.md` | S |

---

### Sprint B – RAG-Pipeline (Woche 2–4)

| # | Aufgabe | Dateien | Aufwand |
|---|---------|---------|---------|
| B1 | pgvector-Extension + `embedding`-Kolumne in Guideline-Modell | `backend/app/models.py`, Alembic-Migration | M |
| B2 | Embedding-Worker: Text → Embedding-API → DB | `backend/app/api/guidelines.py`, `backend/app/tasks.py` | M |
| B3 | Semantic-Search-Endpunkt (`/api/v1/guidelines/semantic-search`) | `backend/app/api/guidelines.py` | S |
| B4 | Frontend: GuidelinesPanel auf semantische Suche umstellen | `src/components/RightPanel/GuidelinesPanel.tsx` | S |

**B1-Detail:** `pgvector`-Extension per `CREATE EXTENSION IF NOT EXISTS vector` in
Migration. `Guideline`-Modell bekommt `embedding: Vector(1536) | None`. LIKE-Suche
bleibt als Fallback für SQLite/Tests erhalten.

---

### Sprint C – DICOM→JPEG Pipeline (Woche 3–5)

| # | Aufgabe | Dateien | Aufwand |
|---|---------|---------|---------|
| C1 | `retrieve_rendered_frame(study, series, instance, frame)` in `dicom_client.py` | `backend/app/dicom_client.py` | S |
| C2 | Worker-Task `run_inference_job` nutzt `retrieve_rendered_frame` wenn keine `image_urls` | `backend/app/tasks.py` | S |
| C3 | Redis-Caching (TTL 5 min) für retrievte Frames | `backend/app/tasks.py`, `backend/app/queue.py` | S |

**C1-Detail:** WADO-RS Rendered-Endpunkt:
`GET {base_url}/studies/{study}/series/{series}/instances/{sop}/frames/{n}/rendered`
mit `Accept: image/jpeg`. Rückgabe als `bytes`. Auth via `_orthanc_auth()`.

---

### Sprint D – Evidence-Indices + 3D-Readiness (Woche 4–5)

| # | Aufgabe | Dateien | Aufwand |
|---|---------|---------|---------|
| D1 | `model_validator` in `ai_schemas.py`: `evidence_indices` Pflicht wenn `image_refs` nicht leer | `backend/app/ai_schemas.py` | XS |
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
| G1 | Self-signed / Let's-Encrypt TLS in `nginx.conf` | `docker/nginx.conf`, `docker-compose.yml` | S |
| G2 | `env.example` mit TLS-Vars ergänzen | `env.example` | XS |

---

## Priorisierte Reihenfolge

```
Sprint A (Compliance-Doku)    ← sofort startbar, kein Code-Risiko
Sprint B (RAG)                ← parallel zu A, Prerequisite für semantische Suche
Sprint C (DICOM Pipeline)
Sprint D (Evidence + 3D)      ← D1 ist XS, sofort umsetzbar
Sprint E (Longitudinal)
Sprint F (Tracing) ──┐
Sprint G (TLS)    ───┘  parallel in Woche 7–8
```

GAP-09 (WSI) und GAP-10 (Data Capture) werden nach Sprint E bewertet und auf
Phase 6 verschoben.

---

## Aufwandsschätzung (T-Shirt Sizes)

| Size | Aufwand |
|------|---------|
| XS | < 1 h |
| S | 0,5–1 Tag |
| M | 2–3 Tage |

Gesamtaufwand Sprints A–G: **~16–20 Personentage**
(Reduktion gegenüber ursprünglichem Plan durch Behebung von GAP-01)

---

## Abhängigkeiten

- **B1 → B2 → B3 → B4** (pgvector muss vor Embedding-Worker laufen)
- **C1 → C2** (retrieve_frame Prerequisite für Worker)
- **D1** ist unabhängig (XS, sofort umsetzbar)
- **E1 → E2 → E3**
- **F1 → F2 → F3**
- Sprint A hat keine Abhängigkeiten, sofort startbar
