# Testing

## Unit Tests

```bash
npm run test
```

## Documentation (MkDocs)

```bash
pip install -r requirements-docs.txt
python3 -m mkdocs build --strict
```

`--strict` aborts on warnings (e.g. dead internal links).

## Backend Smoke Check

```bash
./scripts/smoke-backend.sh
```

Optional:

```bash
API_BASE_URL=http://localhost:8000 ./scripts/smoke-backend.sh
```

## Recommended Areas

- ASR/AI status handling
- QA check rendering
- Template application

## E2E (planned)

Playwright or Cypress for the report workflow.
