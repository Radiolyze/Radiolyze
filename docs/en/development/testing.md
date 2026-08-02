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

- **Mocked-network flows** (`e2e/auth.spec.ts`, `e2e/core-workflow.spec.ts`) stub backend responses with `page.route(...)` instead of requiring a live stack. These are fast, deterministic, and run non-blocking in CI (`e2e-frontend` job) on every push/PR. The shared stubs — locale pinning, DICOMweb QIDO-RS responses, and the report/inference/QA endpoints — live in `e2e/fixtures/backend.ts`; add new specs against those rather than re-rolling `page.route(...)` handlers.
- **Full-stack flows** (planned — see the scenarios below) drive the real backend/DB/Orthanc via `docker compose`, for the workflows that actually need real data (DICOM viewer pixel rendering, ASR, real AI inference).

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
npx playwright test e2e/auth.spec.ts
```

### Key Scenarios to Cover

Covered today:

- `e2e/auth.spec.ts` — login form, invalid-credential handling, 401-redirect route guard.
- `e2e/core-workflow.spec.ts` — the golden path: studies appear in the queue, selecting one loads its series, findings are written and saved, the AI impression is generated, the QA result renders, and the report is finalized with a signature.

The remaining scenarios below still need work — either a real backend (Orthanc-seeded study data, inference/QA pipeline) or app-side hooks that don't exist yet:

| Test scenario | Why |
|---|---|
| Trigger ASR → see transcript in findings | Core dictation workflow |
| Generate AI impression → verify evidence indices light up | AI integration |
| QA failure blocks approval | Safety-critical — must block |
| Critical finding alert appears | Safety-critical |
| Keyboard shortcut `Ctrl+Enter` opens approval dialog | Core UX |
| Batch queue: approve → auto-advance to next study | Batch workflow |
| DICOM viewer: series scroll, windowing, measurement | Needs real pixel data |

### Example Spec (target shape for a full-stack flow)

The selectors below (`.study-row`, `[data-testid="impression-textarea"]`, ...) don't all exist in the app yet — this illustrates the shape a full-stack spec should take once written, not a spec that runs today. See `e2e/core-workflow.spec.ts` for a real, currently-passing example of the same workflow against mocked network responses.

```typescript
// e2e/report-workflow.spec.ts
import { test, expect } from "@playwright/test";

test("approve a report via keyboard shortcut", async ({ page }) => {
  await page.goto("/");
  await page.fill('[name="username"]', "test-radiologist");
  await page.fill('[name="password"]', "test-password");
  await page.click('[type="submit"]');

  // Open first study from queue
  await page.click(".study-row:first-child");
  await expect(page.locator(".dicom-viewer")).toBeVisible();

  // Type an impression
  await page.fill('[data-testid="impression-textarea"]', "No acute findings.");

  // Trigger approval dialog with keyboard shortcut
  await page.keyboard.press("Control+Enter");
  await expect(page.locator('[data-testid="approval-dialog"]')).toBeVisible();

  // Confirm
  await page.click('[data-testid="confirm-approve"]');
  await expect(page.locator(".report-approved-banner")).toBeVisible();
});
```

### Playwright Configuration

See `playwright.config.ts` at the repo root. Notes:

- `baseURL` defaults to `http://localhost:5173`; set `E2E_BASE_URL` to point at a different stack (e.g. a docker-compose deployment) instead.
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
