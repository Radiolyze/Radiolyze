# Testing-Leitfaden

Frontend-Unit-Tests, Backend-Unit-/Integrationstests, Smoke-Tests und E2E-Tests ausführen, schreiben und erweitern.

---

## Test-Suite-Übersicht

| Ebene | Framework | Ort | Befehl |
|---|---|---|---|
| Frontend Unit | Vitest | `src/**/*.test.ts` | `npm run test` |
| Backend Unit/Integration | pytest | `backend/tests/` | `cd backend && python -m pytest` |
| Backend Smoke | bash | `scripts/smoke-backend.sh` | `./scripts/smoke-backend.sh` |
| Dokumentationsbuild | mkdocs | `docs/` | `python3 -m mkdocs build --strict` |
| E2E | Playwright | `e2e/` | `npm run e2e` |

Vor jedem Commit alle Prüfungen ausführen:

```bash
npm run build
cd backend && python -m pytest tests/ -v
./scripts/smoke-backend.sh
python3 -m mkdocs build --strict
```

---

## Frontend-Unit-Tests

```bash
# Alle Tests ausführen
npm run test

# Watch-Modus
npm run test -- --watch

# Coverage-Bericht, geprüft gegen die Schwellwerte in vitest.config.ts
npm run test:coverage
```

Die Coverage erfasst alle Dateien unter `src/` — nicht nur die, die ein Test
importiert — ausgenommen die vendorten shadcn-ui-Primitives, Mock-Fixtures und
Übersetzungsressourcen. Die Schwellwerte in `vitest.config.ts` sind eine
**Untergrenze, kein Ziel**: Sie liegen knapp unter der aktuellen Coverage, damit
CI fehlschlägt, wenn sie zurückfällt (siehe #115). Mit wachsender Abdeckung
sollten sie angehoben werden.

Tests liegen neben ihren Quelldateien (`*.test.ts` oder `*.test.tsx`). Schwerpunktbereiche:

- **ASR / KI-Status-Handling** — Ladezustände, Fehlerzustände, Mock-Antworten
- **QA-Check-Rendering** — Pass/Warn/Fail-Anzeige, Score-Berechnung
- **Template-Anwendung** — Felder korrekt aus Template-Presets befüllt
- **Tastaturkürzel-Hooks** — `Ctrl+Enter`, `Ctrl+M`, `Ctrl+S` lösen korrekte Aktionen aus

---

## Backend-Unit-Tests

```bash
cd backend

# Alle Tests ausführen
python -m pytest tests/ -v

# Spezifische Test-Datei
python -m pytest tests/test_qa_engine.py -v

# Mit Coverage
python -m pytest tests/ --cov=app --cov-report=term-missing
```

Vorhandene Test-Dateien:

| Datei | Was gedeckt wird |
|---|---|
| `tests/test_asr_providers.py` | ASR-Provider-Auswahl, Mock-Fallback, Sprachnormalisierung |
| `tests/test_audit.py` | Audit-Event-Erstellung, Feldvalidierung |
| `tests/test_auth.py` | JWT-Erstellung, Validierung, Rollenprüfungen |
| `tests/test_peer_review.py` | Peer-Review-Workflow |
| `tests/test_inference_seams.py` | Dass die unten genannten Inference-Mocking-Punkte tatsaechlich greifen |

### Inference-Flows mocken

`app/inference_clients/` ist ein Paket mit einem Modul je Generierungs-Flow
(`text`, `localize`, `volume`, `comparison`, `streaming`). Darunter liegen genau
zwei Netzwerkgrenzen, und **nur diese sind die richtigen Patch-Ziele**:

```python
patch("app.vllm_client._vllm_chat_completion")            # jeder vLLM-Aufruf
patch("app.segmentation_client.preprocess_for_medgemma")  # volume + comparison
```

Dort patchen, nicht an `app.inference_clients`. Jeder Flow erreicht den Client
ueber das Modulobjekt (`vllm_client._vllm_chat_completion(...)`) statt ueber
einen in die eigenen Globals importierten Namen. Genau das sorgt dafuer, dass
ein Patch alle fuenf Flows abdeckt und weiter greift, wenn ein Flow das Modul
wechselt.

Ein Fehler dabei faellt leise aus, nicht laut: Ein Patch auf den falschen
Namensraum wird trotzdem *angenommen*, wirkt aber nicht — der Flow macht einen
echten HTTP-Aufruf, waehrend der Mock ungenutzt danebenliegt.
`tests/test_inference_seams.py` sichert beide Haelften ab: dass der echte
Patch-Punkt jeden Flow abfaengt, und dass das alte Ziel von vor dem Split
(`app.inference_clients._vllm_chat_completion`) abwesend bleibt, damit
`mock.patch` einen `AttributeError` wirft statt wirkungslos zu bleiben.

**Backend-Test schreiben:**

```python
# backend/tests/test_qa_engine.py
from app.qa_engine import evaluate_rules
from app.models import QARule

def make_rule(rule_type, config, severity="warn"):
    rule = QARule()
    rule.id = "test-1"
    rule.name = "Test"
    rule.rule_type = rule_type
    rule.config_json = config
    rule.severity = severity
    rule.is_active = True
    return rule

def test_min_length_fail():
    rule = make_rule("min_length",
        {"target": "impression", "min_length": 100, "message": "zu kurz"},
        severity="fail")
    _, _, failures, _ = evaluate_rules([rule], "", "Kurz.")
    assert "zu kurz" in failures
```

---

## Smoke-Tests

```bash
# Standard (localhost:8000)
./scripts/smoke-backend.sh

# Eigene URL
API_BASE_URL=http://staging.example.com:8000 ./scripts/smoke-backend.sh
```

Nach jedem Deployment und nach Backend-Änderungen ausführen.

---

## Dokumentationsbuild

```bash
pip install -r requirements-docs.txt
python3 -m mkdocs build --strict
```

`--strict` bricht bei Warnungen ab (tote Links, fehlende Dateien).

**Häufige Fehler:**

| Fehler | Ursache | Lösung |
|---|---|---|
| `Doc file ... contains link ... not found` | Toter interner Link | Link-Pfad korrigieren |
| `Doc file ... not found in docs_dir` | Datei in Nav aber nicht vorhanden | Datei erstellen oder aus Nav entfernen |

---

## E2E-Tests (Playwright)

End-to-End-Tests steuern einen echten Browser. Zwei Stile leben nebeneinander in `e2e/`:

- **Gemockte Flows** (`e2e/auth.spec.ts`, `e2e/workflow.spec.ts`) täuschen Backend-Antworten per `page.route(...)` vor, statt einen laufenden Stack vorauszusetzen. Schnell, deterministisch, laufen als blockierender CI-Job (`e2e-frontend`) bei jedem Push/PR.
- **Full-Stack-Flows** (geplant — siehe Szenarien unten) steuern das echte Backend/DB/Orthanc über `docker compose`, für Workflows, die echte Pixeldaten brauchen (DICOM-Viewer-Scrolling und -Windowing, ASR).

### Gemockte Specs

`e2e/support/` enthält die gemeinsame Basis der gemockten Specs:

- `fixtures.ts` — DICOM-JSON-Datensätze für Studien/Serien/Instanzen sowie Report-Payloads. Die Formen bilden ab, was Orthancs DICOMweb-Endpunkte und `/api/v1/reports` liefern, sodass `dicomWebMapping.ts` und `reportMapping.ts` unverändert darauf laufen.
- `mockBackend.ts` — `mockWorkflowBackend(page, options)` installiert die Routen für DICOMweb, Reports, QA und Inferenz. Der Mock hält lebenden Report-Zustand (verändert durch `PATCH` und Finalize) und protokolliert die abgesetzten Requests, sodass eine Spec sowohl auf das Gerenderte als auch auf den erzeugten Request prüfen kann.

Das Report-Wire-Format ist bewusst in `fixtures.ts` deklariert und nicht aus `src/services/reportClient.ts` importiert: Diese Specs sind Black-Box-Clients des HTTP-Vertrags und sollen fehlschlagen, wenn sich das *Wire-Format* ändert — nicht, wenn ein interner Typ umbenannt wird.

Zwei Verhaltensweisen sind beim Lesen der Specs wichtig:

- **Inferenz dauert einige Sekunden.** Unter `page.route` ist kein WebSocket verbunden, daher fällt `awaitInferenceResult` nach ~4 s auf HTTP-Polling zurück — derselbe Pfad, den ein echtes Deployment bei ausgefallenem Socket nimmt. Wegen dieses Fallbacks hebt `playwright.config.ts` das Test-Timeout über Playwrights 30-s-Default.
- **Pixeldaten werden nicht ausgeliefert.** WADO-RS-Frame-Requests antworten mit 404. Der Workflow braucht die Instanz*liste* (daraus entstehen die an die Inferenz gesendeten Image-Referenzen), und Cornerstone toleriert die fehlenden Pixel.

### Einrichtung

```bash
npm install
npx playwright install chromium
```

### Ausführen

```bash
# Gemockte Specs: nur der Dev-Server wird benötigt, den playwright.config.ts
# automatisch startet
npm run e2e

# Full-Stack-Specs: zuerst den Stack starten, dann Playwright darauf richten
docker compose up --build -d
E2E_BASE_URL=http://localhost:5173 npm run e2e

# Mit UI (headed mode für Debugging)
npx playwright test --headed

# Eine einzelne Spec ausführen
npx playwright test e2e/workflow.spec.ts
```

### Heute abgedeckt

| Testszenario | Spec |
|---|---|
| Login-Formular, ungültige Zugangsdaten, 401-Redirect-Routenschutz | `e2e/auth.spec.ts` |
| Studienauswahl lädt Serien, Report und Viewer-Stack | `e2e/workflow.spec.ts` |
| KI-Analyse füllt Befund und Impression, danach QA | `e2e/workflow.spec.ts` |
| Bearbeitete Befunde werden persistiert und speisen die Impression | `e2e/workflow.spec.ts` |
| QA-Warnungen erscheinen, ohne die Freigabe zu blockieren | `e2e/workflow.spec.ts` |
| Freigabe finalisiert den Report mit Unterschrift | `e2e/workflow.spec.ts` |
| Fehlgeschlagener Inferenz-Job lässt den Report nicht freigebbar | `e2e/workflow.spec.ts` |

### Noch offen

Diese Szenarien brauchen echte Pixeldaten oder Dienste, für die der gemockte Aufbau bewusst nicht einspringt:

| Testszenario | Warum | Voraussetzung |
|---|---|---|
| DICOM-Viewer: Stack scrollen, Window/Level | Kern-Viewing-UX | Orthanc mit echten DICOM-Daten |
| ASR auslösen → Transkript in Befund sehen | Kern-Diktat-Workflow | ASR-Dienst |
| QA-*Fehler* blockiert Freigabe | Sicherheitskritisch | Backend-QA-Regeln, die fehlschlagen können |
| Kritischer-Befund-Alarm erscheint | Sicherheitskritisch | Inferenz-Ausgabe mit kritischem Label |
| Tastaturkürzel `Ctrl+Enter` öffnet Freigabe-Dialog | Kern-UX | — |
| Batch-Warteschlange: Freigabe → automatisch nächste Studie | Batch-Workflow | — |

### Eine neue gemockte Spec schreiben

```typescript
import { test, expect } from "@playwright/test";
import { STUDY_CT, reportIdForStudy } from "./support/fixtures";
import { mockWorkflowBackend, pinEnglishLocale } from "./support/mockBackend";

test("stellt Inferenz für die gewählte Studie in die Queue", async ({ page }) => {
  await pinEnglishLocale(page);
  const backend = await mockWorkflowBackend(page, {
    inference: { summary: "Small left pleural effusion." },
    qa: { passes: true },
  });

  await page.goto("/");
  await page.getByRole("complementary").nth(1).getByRole("button", { name: "AI Analysis" }).click();

  // Prüfen, was der Nutzer sieht ...
  await expect(page.getByText("Passed")).toBeVisible();
  // ... und welchen Request die UI tatsächlich erzeugt hat.
  expect(backend.calls.inferenceQueue[0].body?.report_id).toBe(reportIdForStudy(STUDY_CT));
});
```

`pinEnglishLocale` ist wichtig: `useUserPreferences` setzt `uiLanguage` per Default auf `de` und wendet das beim Mount an — ohne den Aufruf hinge die Sprache in den Assertions von der Navigationsreihenfolge ab.

Am stabilsten lassen sich Locator über die Layout-Landmarks eingrenzen: `getByRole("main")` ist der Viewer, `getByRole("complementary").first()` die linke Sidebar, `.nth(1)` das Report-Panel.

---

## CI-Integration

```yaml
# GitHub Actions Beispiel
jobs:
  test:
    steps:
      - name: Frontend Build & Unit-Tests
        run: npm ci && npm run build && npm run test

      - name: Backend Unit-Tests
        run: |
          cd backend
          pip install -e ".[dev]"
          python -m pytest tests/ -v

      - name: Dokumentationsbuild
        run: |
          pip install -r requirements-docs.txt
          python3 -m mkdocs build --strict

      - name: Smoke-Test
        run: |
          docker compose up --build -d
          sleep 10
          ./scripts/smoke-backend.sh
```

---

## Verwandte Seiten

- [Entwicklungssetup](setup.md)
- [Contributing-Leitfaden](contributing.md)
- [ASR-Provider-Leitfaden](asr-providers.md)
- [QA-Regeln-Leitfaden](qa-rules.md)
