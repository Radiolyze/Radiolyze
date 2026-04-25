# Testing

## Unit Tests

```bash
npm run test
```

## Dokumentation (MkDocs)

```bash
pip install -r requirements-docs.txt
python3 -m mkdocs build --strict
```

`--strict` bricht bei Warnungen (z. B. tote interne Links) ab.

## Backend Smoke Check

```bash
./scripts/smoke-backend.sh
```

Optional:

```bash
API_BASE_URL=http://localhost:8000 ./scripts/smoke-backend.sh
```

## Empfohlene Bereiche

- ASR/AI Status Handling
- QA Check Rendering
- Template Anwendung

## E2E (geplant)

Playwright oder Cypress fuer Report Workflow.
