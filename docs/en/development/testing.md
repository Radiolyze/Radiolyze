# Testing Guide

How to run, write, and extend tests for Radiolyze — frontend unit tests, backend unit/integration tests, smoke tests, and E2E tests.

---

## Test Suite Overview

| Layer | Framework | Location | Command |
|---|---|---|---|
| Frontend unit | Vitest | `src/**/*.test.ts` | `npm run test` |
| Backend unit/integration | pytest | `backend/tests/` | `cd backend && python -m pytest` |
| Backend smoke | bash | `scripts/smoke-backend.sh` | `./scripts/smoke-backend.sh` |
| Documentation build | mkdocs | `docs/` | `python3 -m mkdocs build --strict` |
| E2E | Playwright | `e2e/` | `npm run e2e` |

Run all checks before committing:

```bash
npm run build
cd backend && python -m pytest tests/ -v
./scripts/smoke-backend.sh
python3 -m mkdocs build --strict
```

---

## Frontend Unit Tests

```bash
# Run all tests
npm run test

# Watch mode (re-runs on file change)
npm run test -- --watch

# Coverage report, checked against the thresholds in vitest.config.ts
npm run test:coverage
```

Coverage counts every file under `src/` — not only the ones a test imports —
excluding the vendored shadcn-ui primitives, mock fixtures and translation
resources. The thresholds in `vitest.config.ts` are a **floor, not a target**:
they sit just under current coverage so that CI fails when it slides back
(see #115). Raise them as coverage grows.

Tests live next to their source files (`*.test.ts` or `*.test.tsx`). Focus areas:

- **ASR / AI status handling** — loading states, error states, mock responses
- **QA check rendering** — pass / warn / fail display, score calculation
- **Template application** — fields populated correctly from template presets
- **Keyboard shortcut hooks** — `Ctrl+Enter`, `Ctrl+M`, `Ctrl+S` fire correct actions

**Writing a frontend test:**

```typescript
// src/hooks/__tests__/useQAStatus.test.ts
import { renderHook } from "@testing-library/react";
import { useQAStatus } from "../useQAStatus";

describe("useQAStatus", () => {
  it("returns warn when checks contain a warning", () => {
    const checks = [{ id: "qa-1", name: "Length", status: "warn" }];
    const { result } = renderHook(() => useQAStatus(checks));
    expect(result.current.overallStatus).toBe("warn");
  });
});
```

---

## Backend Unit Tests

```bash
cd backend

# Run all tests
python -m pytest tests/ -v

# Run a specific test file
python -m pytest tests/test_qa_engine.py -v

# Run with coverage
python -m pytest tests/ --cov=app --cov-report=term-missing

# Run only fast tests (exclude integration)
python -m pytest tests/ -v -m "not integration"
```

Existing test files:

| File | What it covers |
|---|---|
| `tests/test_asr_providers.py` | ASR provider selection, mock fallback, language normalisation |
| `tests/test_audit.py` | Audit event creation, field validation |
| `tests/test_auth.py` | JWT creation, validation, role checks |
| `tests/test_peer_review.py` | Peer review workflow |

**Writing a backend test:**

```python
# backend/tests/test_qa_engine.py
from app.qa_engine import evaluate_rules
from app.models import QARule


def make_rule(rule_type: str, config: dict, severity: str = "warn") -> QARule:
    rule = QARule()
    rule.id = "test-rule-1"
    rule.name = "Test Rule"
    rule.rule_type = rule_type
    rule.config_json = config
    rule.severity = severity
    rule.is_active = True
    return rule


def test_min_length_pass():
    rule = make_rule("min_length", {"target": "impression", "min_length": 5, "message": "too short"})
    checks, warnings, failures, score = evaluate_rules([rule], "", "Normal study.")
    assert not failures
    assert score == 100.0


def test_min_length_fail():
    rule = make_rule("min_length", {"target": "impression", "min_length": 100, "message": "too short"}, severity="fail")
    checks, warnings, failures, score = evaluate_rules([rule], "", "Short.")
    assert "too short" in failures
```

---

## Smoke Tests

The smoke test script verifies the backend API is running correctly and all critical endpoints respond as expected.

```bash
# Default: points at http://localhost:8000
./scripts/smoke-backend.sh

# Custom URL
API_BASE_URL=http://staging.example.com:8000 ./scripts/smoke-backend.sh
```

The script checks:
- `/api/v1/health` returns 200
- Authentication endpoints respond correctly
- QA and report endpoints are reachable
- Audit log endpoint returns data

Run the smoke test after every deployment and after any backend change.

---

## Documentation Build

The MkDocs strict build catches broken internal links, missing files referenced in `nav`, and syntax errors in admonitions.

```bash
pip install -r requirements-docs.txt
python3 -m mkdocs build --strict
```

Always run this before merging documentation changes.

**Common errors:**

| Error | Cause | Fix |
|---|---|---|
| `WARNING - Doc file ... contains a link ... which is not found` | Dead internal link | Correct the link path |
| `WARNING - Doc file ... not found in docs_dir` | File in nav but doesn't exist | Create the file or remove from nav |
| `ERROR - Config value 'nav'...` | YAML syntax error in mkdocs.yml | Fix YAML indentation |

---

## E2E Tests (Playwright)

End-to-end tests drive a real browser. Two styles live side by side in `e2e/`:

- **Mocked-network flows** (`e2e/auth.spec.ts`, `e2e/workflow.spec.ts`, `e2e/dictation.spec.ts`) stub backend responses with `page.route(...)` instead of requiring a live stack. These are fast, deterministic, and run as a blocking CI job (`e2e-frontend`) on every push/PR.
- **Full-stack flows** (planned — see the scenarios below) drive the real backend/DB/Orthanc via `docker compose`, for the workflows that need real pixel data (DICOM viewer scrolling and windowing).

### Mocked-network specs

`e2e/support/` holds the shared harness the mocked specs build on:

- `fixtures.ts` — DICOM JSON study/series/instance records and report payloads. The record shapes mirror what Orthanc's DICOMweb endpoints and `/api/v1/reports` return, so the app's own `dicomWebMapping.ts` and `reportMapping.ts` run unmodified against them.
- `mockBackend.ts` — `mockWorkflowBackend(page, options)` installs the routes for DICOMweb, reports, QA, inference and ASR. It keeps live report state (mutated by `PATCH` and finalize) and records the calls the app made, so a spec can assert on the request the UI produced as well as on what it rendered.
- `workspace.ts` — the workspace landmarks (sidebar, viewer, report panel) and the wait that lets the queue and viewer mount, addressed by role rather than by class name.

The report wire format is declared in `fixtures.ts` rather than imported from `src/services/reportClient.ts` on purpose: these specs are black-box clients of the HTTP contract and should fail when the *wire format* changes, not when an internal type is refactored.

Four behaviours are worth knowing when reading the specs:

- **Inference takes a few seconds.** No WebSocket is connected under `page.route`, so `awaitInferenceResult` falls through to its HTTP polling fallback after ~4s — the same path a real deployment takes when the socket is down. That fallback is why `playwright.config.ts` raises the per-test timeout above Playwright's 30s default.
- **Pixel data is not served.** WADO-RS frame requests return 404. The instance *list* is what the workflow needs (it builds the image references sent to inference), and Cornerstone tolerates the missing pixels.
- **Audio is real, transcription is not.** `playwright.config.ts` launches Chromium with `--use-fake-device-for-media-stream`, so `useAudioInput`'s own `getUserMedia`/`MediaRecorder` path runs and produces a genuine WebM blob; only `POST /api/v1/reports/asr-transcript` is stubbed. That upload is `multipart/form-data`, so `mockBackend` records its fields and byte count rather than a parsed JSON body.
- **`VITE_ALLOW_MOCK_FALLBACK` must stay off.** With it set, `useASR` and `useQaChecks` substitute canned results whenever the service fails — which would let the suite pass while the real path is broken. `e2e/dictation.spec.ts` asserts the stubbed transcript specifically, so the flag turns that spec red instead of hiding behind it.

### Setup

```bash
npm install
npx playwright install chromium
```

### Running

```bash
# Mocked-network specs: just need the dev server, which playwright.config.ts
# starts automatically
npm run e2e

# Full-stack specs: start the stack first, then point Playwright at it
docker compose up --build -d
E2E_BASE_URL=http://localhost:5173 npm run e2e

# Run with UI (headed mode for debugging)
npx playwright test --headed

# Run a specific spec
npx playwright test e2e/workflow.spec.ts
```

### Covered Today

| Test scenario | Spec |
|---|---|
| Login form, invalid credentials, 401-redirect route guard | `e2e/auth.spec.ts` |
| Study selection loads its series, report and viewer stack | `e2e/workflow.spec.ts` |
| AI analysis fills findings and impression, then QA passes | `e2e/workflow.spec.ts` |
| Edited findings are persisted and drive impression generation | `e2e/workflow.spec.ts` |
| QA warnings surface without blocking approval | `e2e/workflow.spec.ts` |
| A failed QA check blocks approval | `e2e/workflow.spec.ts` |
| Approval finalizes the report with the signature | `e2e/workflow.spec.ts` |
| A failed inference job leaves the report un-approvable | `e2e/workflow.spec.ts` |
| Dictation transcribes the recording into the findings | `e2e/dictation.spec.ts` |
| A failed transcription leaves the findings untouched | `e2e/dictation.spec.ts` |

### Still to Cover

These need real pixel data or services the mocked harness deliberately doesn't stand in for:

| Test scenario | Why | What it needs |
|---|---|---|
| DICOM viewer: scroll a stack, window/level | Core viewing UX | Seeded Orthanc with real DICOM |
| Critical finding alert appears | Safety-critical | Inference output with a critical label |
| Keyboard shortcut `Ctrl+Enter` opens approval dialog | Core UX | — |
| Batch queue: approve → auto-advance to next study | Batch workflow | — |

### Writing a New Mocked Spec

```typescript
import { test, expect } from "@playwright/test";
import { STUDY_CT, reportIdForStudy } from "./support/fixtures";
import { mockWorkflowBackend, pinEnglishLocale } from "./support/mockBackend";

test("queues inference for the selected study", async ({ page }) => {
  await pinEnglishLocale(page);
  const backend = await mockWorkflowBackend(page, {
    inference: { summary: "Small left pleural effusion." },
    qa: { passes: true },
  });

  await page.goto("/");
  await page.getByRole("complementary").nth(1).getByRole("button", { name: "AI Analysis" }).click();

  // Assert on what the user sees...
  await expect(page.getByText("Passed")).toBeVisible();
  // ...and on the request the UI actually produced.
  expect(backend.calls.inferenceQueue[0].body?.report_id).toBe(reportIdForStudy(STUDY_CT));
});
```

`pinEnglishLocale` matters: `useUserPreferences` defaults `uiLanguage` to `de` and applies it on mount, so without it the language the assertions see depends on navigation order.

The layout landmarks are the most stable way to scope a locator — `getByRole("main")` is the viewer, `getByRole("complementary").first()` the left sidebar, `.nth(1)` the report panel.

### Playwright Configuration

See `playwright.config.ts` at the repo root. Notes:

- `baseURL` defaults to `http://localhost:5173`; set `E2E_BASE_URL` to point at a different stack (e.g. a docker-compose deployment) instead.
- `timeout` is raised to 60s from Playwright's 30s default, for the inference specs' polling fallback and Vite's first-request compile on a cold run.
- The `webServer` auto-start (`npm run dev`) is skipped whenever `E2E_BASE_URL` is set, since that implies a stack is already running.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE` lets a sandboxed/offline environment point at a pre-installed Chromium build instead of the one `@playwright/test` would otherwise try to download — not needed for a normal `npx playwright install`.

---

## CI Integration

Add to your CI pipeline (GitHub Actions example):

```yaml
jobs:
  test:
    steps:
      - name: Frontend build & unit tests
        run: |
          npm ci
          npm run build
          npm run test:coverage

      - name: Backend unit tests
        run: |
          cd backend
          pip install -e ".[dev]"
          python -m pytest tests/ -v

      - name: Documentation build
        run: |
          pip install -r requirements-docs.txt
          python3 -m mkdocs build --strict

      - name: Smoke test (integration)
        run: |
          docker compose up --build -d
          sleep 10
          ./scripts/smoke-backend.sh
```

---

## Related

- [Development Setup](setup.md) — getting the stack running
- [Contributing Guide](contributing.md) — testing requirements per change type
- [ASR Provider Guide](asr-providers.md) — testing ASR configuration
- [QA Rules Guide](qa-rules.md) — testing QA rule changes
