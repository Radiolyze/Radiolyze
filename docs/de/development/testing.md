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
| E2E (geplant) | Playwright | `e2e/` | `npm run e2e` |

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

# Coverage-Bericht
npm run test -- --coverage
```

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

End-to-End-Tests steuern einen echten Browser gegen den vollständigen Stack.

### Einrichtung

```bash
npm install
npx playwright install chromium
```

### Ausführen

```bash
# Stack starten
docker compose up --build -d

# E2E-Tests ausführen
npm run e2e

# Mit UI (headed mode für Debugging)
npx playwright test --headed
```

### Wichtige zu abdeckende Szenarien

| Testszenario | Warum |
|---|---|
| Login → Studie öffnen → Bericht freigeben | Golden Path — muss immer bestehen |
| ASR auslösen → Transkript in Befund sehen | Kern-Diktat-Workflow |
| KI-Impression generieren → Evidence-Indices leuchten auf | KI-Integration |
| QA-Fehler blockiert Freigabe | Sicherheitskritisch |
| Kritischer-Befund-Alarm erscheint | Sicherheitskritisch |
| Tastaturkürzel `Ctrl+Enter` öffnet Freigabe-Dialog | Kern-UX |
| Batch-Warteschlange: Freigabe → automatisch nächste Studie | Batch-Workflow |

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
