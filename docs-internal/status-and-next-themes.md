# Statusaufnahme & Planung der nächsten Themen

**Erstellt:** 2026-09-02
**Methode:** Code-Abgleich gegen `main` @ `0081341`, alle 11 offenen Issues,
20 offene PRs, `docs/en/roadmap.md`, `docs-internal/gap-analysis-plan.md`
**Löst ab:** `docs-internal/gap-analysis-plan.md` (2026-04-25) — dessen
GAP-Liste ist vollständig abgearbeitet

---

## Kernbefund

**Der Backlog ist abgearbeitet, der Tracker nicht.**

Von den 11 offenen Issues sind **9 im Code vollständig umgesetzt**. Der
Gap-Analyse-Plan vom April ist zu 100 % erledigt — GAP-02 bis GAP-08 und GAP-11
sind alle implementiert. Die Roadmap trägt acht `[ ]`-Punkte, die ebenfalls
fertig sind.

Das ist kein Schönheitsfehler: **die veraltete Ablage hat bereits zweimal
Doppelarbeit erzeugt.** #233/#236 (Training.tsx) und #266/#267 (Service-Layer)
wurden je von zwei Durchläufen im Abstand von 1 bzw. 74 Sekunden begonnen,
weil beide dieselbe offene Aufgabe im Tracker fanden. Je ein kompletter PR
wurde als Duplikat geschlossen. Solange der Tracker Erledigtes als offen
führt, wiederholt sich das.

---

## Verifizierter Ist-Stand

### Issues — 9 von 11 sind erledigt

| Issue | Thema | Beleg auf `main` | Status |
|---|---|---|---|
| #99 | Secrets-Härtung | `docker-compose.yml` durchgängig `${VAR:?…}`, kein Default mehr | ✅ erledigt |
| #102 | DB-Indexes + Timestamps | `UTCDateTime` an 27 Spalten, Migration `0005_timestamps_to_timestamptz` | ✅ erledigt |
| #106 | WS-Auth/Heartbeat | `WS_HEARTBEAT_INTERVAL_SECONDS`/`WS_IDLE_TIMEOUT_SECONDS`/`WS_ALLOW_QUERY_TOKEN` in `api/ws.py` | ✅ erledigt |
| #113 | react-query-Migration | `useDicomWebQueue`/`usePriorStudies`/`usePriorReports` auf `useQuery` | ✅ erledigt |
| #115 | Unit-Testabdeckung | `useReport` 77 Zeilen, Split in `hooks/reporting/`, 51 Testdateien | ✅ erledigt |
| #120 | Monolithen aufteilen | Batch/MeshViewer/useReport aufgeteilt, `hooks/{mesh,reporting,training,workspace}/` | ✅ erledigt (Frontend) |
| #121 | Code-Hygiene | `src/lib/date.ts` existiert, `mockData.ts` ohne Datums-Helfer | ✅ erledigt |
| #123 | Service-Layer | `api/reports.py` 596 Zeilen, 0× `add_audit_event`/`utc_now`, 11 Services | ✅ erledigt |
| #117 | i18n | **Rest offen** — siehe Thema 4 | ⚠️ ~90 % |
| #116 | Playwright-E2E | Kern-Workflow abgedeckt, Viewer-Interaktion offen | ⚠️ teilweise |
| #196 | ESLint 9 → 10 | upstream blockiert (`eslint-plugin-jsx-a11y`) | ⏸️ blockiert |

### Gap-Analyse-Plan (April) — vollständig abgearbeitet

| GAP | Thema | Beleg |
|---|---|---|
| GAP-02 | RAG statt LIKE | `/semantic-search`, `_pgvector_search`, `utils/embedding.py`, `Guideline.embedding_vec` |
| GAP-03 | Annex IV / Compliance | `risk-management.md`, `model-card-medgemma.md`, `evidence-overview.md` (EN+DE) |
| GAP-04 | DICOM→JPEG-Pipeline | `dicom_client.retrieve_rendered_frame()` + `retrieve_and_cache_frame()` |
| GAP-05 | Tracing | `opentelemetry-*` in `requirements.txt`, `backend/app/tracing.py` |
| GAP-06 | Evidence-Indices Pflicht | `model_validator` in `ai_schemas.py:63` |
| GAP-07 | 3D-Readiness | `compareInstancesBySlice` (IPP-z → SliceLocation → InstanceNumber), VOI/WL in localStorage |
| GAP-08 | Longitudinal Context | `ReportComparison`-Modell, Migration `0004_report_comparisons` |
| GAP-11 | TLS | `docker/compose/tls.yml`, `nginx-tls.conf.template`, `tls-render.sh` |

Auch **M2 (TotalSegmentator)** und **M3 (Polish)** sind entgegen der Roadmap
umgesetzt: `segment_total.py`, `colors.py`, `MeshColorPicker.tsx`,
`useMeshClipPlane.ts`, `MeshLabelSkeletonPanel.tsx`, `Dockerfile.rocm`.

### Messbare technische Schuld

| Kennzahl | Ist | Bemerkung |
|---|---|---|
| mypy-Fehler | **107 in 29 Dateien** | CI `continue-on-error: true` — einziges nicht-blockierendes Backend-Gate |
| Coverage-Schwelle Frontend | 11 % Statements | ausdrücklich Boden, kein Ziel |
| `npm audit` | non-blocking | wartet auf dcmjs-Release ohne betroffene adm-zip-Range |
| Offene Dependabot-PRs | **20** | ältester 2026-08-10, nur ESLint ist bewusst zurückgehalten |
| Backend-Großdateien | `tasks.py` 975, `api/training.py` 752, `api/inference.py` 615 | #120 war rein Frontend-skopiert; `inference_clients.py` (774) ist unter #293 in ein Paket aufgeteilt |

---

## Nächste Themen — priorisiert

### Thema 1 — Tracker & Roadmap in Deckung bringen  ▸ ✅ erledigt 2026-09-02

**Warum zuerst:** billigste Maßnahme mit dem größten Hebel. Sie beendet die
Doppelarbeit, die bereits zwei PRs gekostet hat, und stellt her, dass die
Issue-Liste wieder eine belastbare Arbeitsgrundlage ist.

1. ✅ #99, #102, #106, #113, #115, #120, #121, #123 geschlossen, jeweils mit
   dem konkreten Beleg auf `main` im Abschlusskommentar.
2. ✅ #117 und #116 auf ihren tatsächlichen Restumfang neu geschnitten — der
   Stand steht jetzt im Issue-Body statt am Ende von 16 bzw. 6 Kommentaren.
3. ✅ `docs/en/roadmap.md` + DE-Spiegel: 13 Einträge je Sprache korrigiert.
   Acht waren fälschlich offen, fünf überzeichneten den offenen Rest. Zwei
   bleiben bewusst `[~]` statt abgehakt — Security Hardening (AuthZ/RBAC
   ungenutzt) und M3 (Mesh-Bundle-Budget). Sechs Punkte bleiben offen.
   Dazu ein Abgleichsdatum im Kopf beider Dateien, damit die Drift beim
   nächsten Mal sichtbar ist statt still.
4. ✅ `docs-internal/gap-analysis-plan.md` als vollständig abgearbeitet
   gekennzeichnet — nicht gelöscht: die `docs-internal/README.md` hält
   ausdrücklich fest, dass alte Pläne als historischer Kontext bleiben.
5. ✅ Zwei neue Issues für real offene, bisher unverfolgte Arbeit:
   **#292** (mypy-Backlog, Thema 2) und **#293** (Backend-Großdateien, Thema 6).

Offener Tracker danach: **5 Issues** — #116, #117, #196, #292, #293.

**Aufwand:** ~0,5 Tag. Kein Code-Risiko.

---

### Thema 2 — mypy-Backlog auf 0, dann Gate scharf schalten  ▸ #292

**Warum:** `mypy` ist die einzige Prüfung im Backend-CI, die nicht blockiert.
Der Kommentar in `ci.yml` sagt seit Einführung „report only until the backlog
is cleaned up" — der Backlog ist seither nicht kleiner geworden. Solange das
Gate offen ist, wächst er weiter.

Die 107 Fehler sind stark konzentriert; die Hälfte steckt in fünf Dateien:

| Datei | Fehler |
|---|---|
| `app/api/reports.py` | 22 |
| `app/api/inference.py` | 8 |
| `app/tasks.py` | 7 |
| `app/services/report_service.py` | 7 |
| `app/api/annotations.py` | 6 |
| Rest (24 Dateien) | 57 |

**Vorgehen:** modulweise, nicht als ein großer PR. Pro PR eine Datei-Gruppe,
und in `pyproject.toml`/`mypy.ini` ein per-Modul-`strict`-Allowlist mitführen,
die wächst — so kann das Gate schon blockieren, bevor die letzte Datei
sauber ist. Reihenfolge nach Fehlerdichte, `reports.py` zuerst.

**Wichtig:** `no-any-return`- und `assignment`-Fehler sind oft echte
Typlücken, keine Annotationskosmetik. Der Fund in #232 (`.tzinfo` auf einem
`str`, HTTP 500 in Produktion) kam aus genau dieser Ecke. Jede Korrektur, die
ein reales Fehlverhalten aufdeckt, gehört mit Test gepinnt.

**Aufwand:** ~2–3 Tage über 4–5 PRs.

---

### Thema 3 — Dependabot-Rückstau abbauen

20 offene PRs, der älteste vom 2026-08-10. Nur `eslint <10` ist laut
`docs/en/development/dependencies.md` bewusst zurückgehalten; die übrigen 19
sind schlicht ungeprüft. Mit jeder Woche wachsen sie und veralten gegen `main`
(#250 steht bereits auf `mergeable_state: unstable`).

**Aufteilen nach Risiko** — die Policy in `dependencies.md` gibt die Kriterien vor:

- **Patch/Minor, sammelbar** (#270 ruff-pre-commit, #282 sqlalchemy, #283
  alembic, #288 fakeredis, #289 uvicorn, #290 rq, #291 reportlab, #287
  python-dev-tools, #286 lucide-react, #249 playwright, #285 typescript-eslint):
  Checks laufen lassen, gebündelt mergen.
- **Floor-Bumps im Segmenter** (#280 totalsegmentator, #281 fast-simplification):
  ändern nur die erlaubte Untergrenze, nicht das Installierte.
- **Majors — je eigene Migration:** #250 TypeScript 7, #276 date-fns 4,
  #279 sonner 2, #273 @types/node 26, #256 eslint-plugin-react-hooks 7,
  #284 Cornerstone-Gruppe.

`sonner` und `date-fns` sind genau die Form, vor der die Policy warnt: sauberer
Install, grünes CI, verändertes Laufzeitverhalten. `date-fns` 4 bringt
Zeitzonen-Umbau — nach der `timestamptz`-Migration aus #102 ist das der Ort,
an dem sich eine stille Verschiebung zeigen würde. Vor dem Merge ein Test,
der das Verhalten festnagelt, nicht erst danach.

**Aufwand:** ~1 Tag für die Sammel-PRs, je 0,5–1 Tag pro Major.

---

### Thema 4 — #117 i18n abschließen und absichern  ▸ #117

Verifizierter Rest — kleiner, als der Issue-Verlauf nahelegt:

| Datei | Art |
|---|---|
| `src/components/Viewer/VRTToolbar.tsx` | kein `useTranslation`, 2 Literale |
| `src/components/Viewer/AIFindingsOverlay.tsx` | kein `useTranslation`, Matching auf dt. Schlüsselwörtern |
| `src/components/Viewer/DicomViewerStateOverlay.tsx` | 1 `title`-Attribut |
| `src/types/{vrt,mpr,annotations}.ts` | Label-Tabellen |
| `src/data/mockData.ts` | Fixtures |

Zwei Fälle brauchen eine Entscheidung statt eines `t()`-Sweeps:

- **`src/types/*.ts`** sind Label-Tabellen, keine Markup-Strings. Sauber ist
  ein Schlüssel im Datenobjekt, aufgelöst an der Render-Stelle — nicht
  `useTranslation` im Typ-Modul.
- **`AIFindingsOverlay.tsx`** matcht auf deutschen Wortstämmen (`läsion`,
  `ödem`, `gefäß`), um Befunde einzufärben. Das ist keine Übersetzung, sondern
  eine sprachabhängige Klassifikationslogik im Frontend — die gehört an die
  Kategorie des Befundes, nicht an seinen Text. Der eigentliche Fix ist ein
  Kategoriefeld aus dem Backend.
- **`mockData.ts`** sind Demo-Fixtures. Sie zu übersetzen hat keinen Wert;
  besser ausdrücklich als deutschsprachige Beispieldaten kennzeichnen.

Dazu die im Issue vorgeschlagene ESLint-Regel (`i18next/no-literal-string`),
zunächst als Warnung auf `src/components/**` — sonst wächst der Bestand
zurück. Der Regressionstest aus #234 (Auflösung jedes `t(key, fallback)`
gegen die Resources) ist die zweite Hälfte der Absicherung und existiert bereits.

**Aufwand:** ~1 Tag ohne den `AIFindingsOverlay`-Umbau, +0,5 Tag mit.

---

### Thema 5 — Coverage-Ratchet ziehen

Die Schwellen in `vitest.config.ts` (11 % Statements, 11 % Lines, 26 %
Branches, 32 % Functions) sind seit #230 unverändert. Sie waren als Boden
gedacht, der mit der Abdeckung mitwandert — bisher ist er nicht mitgewandert,
obwohl seither die Splits aus #120 und die Hook-Tests aus #115/#238 dazukamen.

Ist-Abdeckung messen, Schwelle auf den Ist-Wert minus kleiner Puffer setzen,
und diesen Schritt in die Definition of Done für Test-PRs aufnehmen.

**Aufwand:** ~2 h.

---

### Thema 6 — Backend-Großdateien aufteilen  ▸ #293

#120 hat die Frontend-Monolithen zerlegt und ist damit erledigt; das
Backend-Pendant wurde nie erfasst:

| Datei | Zeilen |
|---|---|
| `backend/app/tasks.py` | 975 |
| `backend/app/api/training.py` | 752 |
| `backend/app/api/inference.py` | 615 |

`tasks.py` ist der lohnendste Einstieg: Worker-Jobs für Inference,
Localize, Segmentierung, Embedding und Drift liegen in einer Datei, und
sieben mypy-Fehler sitzen dort — Thema 2 und Thema 6 überschneiden sich hier
und sollten in derselben Sequenz laufen.

Muster liegt vor: die Service-Layer-Migration aus #123 und die
Hook-Verzeichnisse aus #120 haben beide funktioniert und sind
verhaltenswahrend gefahren worden.

**Aufwand:** ~2–3 Tage.

---

### Thema 7 — Viewer-Interaktion end-to-end  ▸ #116

Der Kern-Workflow ist seit #239 abgedeckt und der `e2e-frontend`-Job
blockierend. Offen bleibt, was der Issue als Flow 2 nennt: Serien-Scrolling,
Windowing, Messungen.

Das ist bewusst nicht mit Netzwerk-Stubs zu lösen — Cornerstone rendert echte
Pixeldaten auf ein Canvas. Es braucht eingespielte DICOM-Fixtures (synthetisch
erzeugt, klein, im Repo oder per Skript generiert) und einen Orthanc im
Test-Compose. Damit ist es ein anderer Testtyp als die bestehende Suite und
gehört in einen eigenen Job, der zunächst nicht blockiert.

**Vorbedingung:** Entscheidung, ob synthetische DICOMs ins Repo dürfen oder
per `scripts/` erzeugt werden. Das ist die eigentliche offene Frage, nicht
der Testcode.

**Aufwand:** ~3–4 Tage.

---

### Thema 8 — Phase 6, das eigentliche Produktthema

Wenn die Themen 1–7 abgeräumt sind, ist zum ersten Mal seit Monaten wieder
Feature-Arbeit statt Nacharbeit dran. Aus `docs/en/roadmap.md` real offen:

- Performance: Web Worker, Streaming
- Analytics-Dashboard (`Monitoring.tsx` mit 506 Zeilen ist der Ansatzpunkt)
- Multi-Site-Deployment
- WSI/Patch-Manifest und Data-Capture-Modus (aus 5.5 hierher verschoben)
- Medusa/Multi-Token-Decoding

Diese Punkte sind nicht analysiert, nur gelistet. Bevor einer davon startet,
gehört er durch dieselbe Aufnahme wie oben — sonst entsteht der nächste Plan,
der vier Monate später komplett erledigt und trotzdem offen ist.

---

## Empfohlene Reihenfolge

```
Thema 1 (Tracker)         ← sofort, 0,5 Tag, beendet die Doppelarbeit
Thema 2 (mypy)   ─┐
Thema 3 (Deps)   ─┴─ parallel: verschiedene Ökosysteme, keine Überschneidung
Thema 4 (i18n)            ← klein, gut als Zwischenstück
Thema 5 (Coverage)        ← 2 h, an Thema 4 anhängen
Thema 6 (Backend-Split)   ← mit Thema 2 verzahnen (tasks.py)
Thema 7 (Viewer-E2E)      ← braucht vorab die Fixture-Entscheidung
Thema 8 (Phase 6)         ← erst nach eigener Aufnahme
```

**Gesamtaufwand Themen 1–7:** ~10–13 Personentage.

---

## Was dieses Dokument nicht behauptet

Die Verifikation ist ein Code-Abgleich, kein Testlauf: `npm`-Abhängigkeiten
sind in dieser Umgebung nicht installiert, die Frontend- und Backend-Suiten
liefen hier nicht. Die mypy-Zahl (107 Fehler in 29 Dateien) ist gemessen,
die Testzahlen aus den PR-Beschreibungen sind übernommen, nicht nachgeprüft.
