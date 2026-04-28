# Contributing Guide

How to set up for development, write code that meets Radiolyze's standards, and get changes merged.

---

## Before You Start

1. Read the [Development Setup](setup.md) guide — get the full stack running locally
2. Read [Style Guide](styleguide.md) — UI, code, and language conventions
3. Check open issues for existing discussion before creating a duplicate
4. For large changes (new features, architectural changes), open an issue first to discuss approach

---

## Development Environment

See [Setup](setup.md) for the full quickstart. Key commands:

```bash
# Start full stack (CPU mode)
docker compose up --build

# Frontend only (faster iteration)
npm install && npm run dev
# → http://localhost:5173

# Backend only
cd backend && pip install -e ".[dev]" && uvicorn app.main:app --reload
# → http://localhost:8000

# Run all checks before committing
npm run build          # TypeScript compile + Vite build
cd backend && python -m pytest tests/ -v
```

---

## Branch Strategy

| Branch type | Naming | Merges into |
|---|---|---|
| Feature | `feat/short-description` | `main` |
| Bug fix | `fix/short-description` | `main` |
| Documentation | `docs/short-description` | `main` |
| Hotfix | `hotfix/short-description` | `main` + tag |

- One branch per work package
- Keep branches short-lived (merge within days, not weeks)
- Rebase on `main` before opening a PR; never merge `main` into your branch

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

<optional body>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`

Examples:

```
feat(qa): add regex_match rule type
fix(asr): handle empty response from Whisper endpoint
docs(compliance): add FMEA table to risk-management.md
test(backend): add unit tests for evaluate_rules()
```

Scope is optional but helpful: `viewer`, `reporting`, `qa`, `asr`, `inference`, `auth`, `admin`, `docs`.

---

## Code Standards

### TypeScript / Frontend

- **Strict TypeScript** — `strict: true` in `tsconfig.json`; no `any` without justification
- **No new dependencies without team review** — check bundle size impact; prefer built-in or already-used libraries
- **Dark mode compatible** — test all UI changes in both light and dark mode
- **Accessibility** — keyboard focus must be visible; interactive elements must have accessible labels
- **No PHI in console logs** — `console.log(patientName)` is never acceptable

```bash
# Type check
npm run tsc --noEmit

# Lint
npm run lint
```

### Python / Backend

- **Type annotations on all public functions** — use `from __future__ import annotations`
- **No bare `except:`** — always catch specific exceptions
- **No PHI in log statements** — log IDs and hashes, not names or text content
- **Environment variable access** — use the `_env_flag()` / `_env_int()` helpers in `inference_clients.py` / `asr_providers.py`, not bare `os.environ.get()`
- **DB operations** — use the SQLAlchemy session from `deps.py`; never raw SQL strings

```bash
cd backend
python -m pytest tests/ -v
python -m mypy app/ --ignore-missing-imports
```

---

## Pre-Commit Checklist

Before opening a PR, verify:

- [ ] `npm run build` passes without errors (TypeScript + Vite)
- [ ] `cd backend && python -m pytest tests/ -v` all pass
- [ ] No PHI (patient name, DOB, raw findings) in any log statement
- [ ] Keyboard shortcuts work correctly (test manually)
- [ ] Dark mode looks correct
- [ ] Accessibility focus is visible on new interactive elements
- [ ] Audit events are created for any new significant action (report state changes, AI calls, admin operations)
- [ ] If adding a new env var: documented in `docs/en/development/setup.md` and `.env.example`
- [ ] If changing the API: `docs/en/api/endpoints.md` and `docs/en/api/schemas.md` updated

---

## Pull Request Process

1. Open a PR against `main` with a clear title (Conventional Commits format)
2. PR description must include:
   - What problem this solves
   - How to test it manually
   - Screenshots for any UI changes
3. Assign at least one reviewer
4. All CI checks must pass before merge
5. Squash-merge to keep `main` history clean

**PR title format:**

```
feat(qa): add min_length rule type with configurable target field
```

---

## Testing Requirements

- **New backend logic**: unit test in `backend/tests/` covering happy path + error case
- **New API endpoints**: smoke test entry in `scripts/smoke-backend.sh` or a pytest integration test
- **New frontend components**: manual test of the golden path (normal case) and one edge case
- **Security-relevant changes** (auth, input validation, logging): peer review by a second person

See [Testing Guide](testing.md) for test runner commands and E2E setup.

---

## Security-Sensitive Areas

Extra care required when touching:

| Area | Risk | What to check |
|---|---|---|
| `backend/app/auth.py` | Authentication bypass | JWT validation, token expiry, role checks |
| `backend/app/asr_providers.py` | Audio data handling | No audio written to disk, no PHI in logs |
| `backend/app/audit.py` | Audit log integrity | Events fire on all required actions; no PHI in metadata |
| `backend/app/qa_engine.py` | QA bypass | Rules cannot be silently disabled; severity cannot be downgraded at runtime |
| Any logging statement | PHI leakage | Patient name, DOB, MRN, raw findings text must never appear in logs |
| DICOM handling | PHI exposure | DICOM tags contain patient demographics; scrub before logging |

---

## Adding a New API Endpoint

1. Add route handler in `backend/app/api/`
2. Add Pydantic schema in `backend/app/schemas.py`
3. Write a unit test in `backend/tests/`
4. Add a smoke test entry in `scripts/smoke-backend.sh`
5. Update `docs/en/api/endpoints.md`
6. If the endpoint involves AI or report state: add an audit event

---

## Adding a New Frontend Component

1. Create the component in `src/components/<Category>/`
2. Export from the category's `index.ts`
3. If it has keyboard shortcuts: add them to `KeyboardShortcutsSheet.tsx` and update `docs/en/doctors/tastenkuerzel.md`
4. Test in dark mode and with keyboard navigation
5. If it interacts with a new API endpoint: add the API client function in `src/api/`

---

## Documentation

- **All user-facing changes** → update relevant `docs/en/` pages
- **DE translations** → update matching `docs/de/` pages (same filename)
- **New pages** → add to `mkdocs.yml` nav section + DE `nav_translations`
- **Build docs locally** to catch broken links:

```bash
pip install -r requirements-docs.txt
python3 -m mkdocs build --strict
```

See [i18n Guide](i18n.md) for translation workflow.

---

## Release Process

1. All features for the release merged to `main`
2. Update version references in `docker-compose.yml`, `package.json`, backend
3. Run full smoke test on a clean Docker environment
4. Tag: `git tag v0.X.Y && git push --tags`
5. Create GitHub release with changelog
6. Announce on project channels

---

## Related

- [Development Setup](setup.md)
- [Style Guide](styleguide.md)
- [Testing Guide](testing.md)
- [i18n Guide](i18n.md)
- [ASR Provider Guide](asr-providers.md)
- [QA Rules Guide](qa-rules.md)
