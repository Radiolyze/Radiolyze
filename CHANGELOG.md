# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries before this file was introduced are not backfilled — see `git log`
for the full history.

## [Unreleased]

### Added

- `docs/en/development/dependencies.md` (and the DE mirror): the dependency
  policy — which majors are held back and why, how a bump is reviewed, and the
  pins that live outside Dependabot's reach.
- `scripts/check-ruff-pin-sync.sh`, run in CI: fails the build when the `ruff`
  pin in `backend/requirements-dev.txt` and the `ruff-pre-commit` rev in
  `.pre-commit-config.yaml` drift apart. Dependabot proposes them as two
  separate PRs, so they have to be merged together.
- A `pre-commit` Dependabot ecosystem, so hook revisions in
  `.pre-commit-config.yaml` are kept current instead of silently rotting.
- `src/components/ui/__tests__/resizable.test.tsx`: pins the
  react-resizable-panels contract the resizable wrapper is built on, so a
  future rename fails a test instead of silently dropping the handle.
- `env.dev`: the local-sandbox credentials that used to be compose defaults.
  `cp env.dev .env` restores the flag-free `docker compose up --build` flow for
  development; the values match what existing dev volumes were initialised
  with, and its `JWT_SECRET_KEY` is deliberately the literal the backend
  rejects in production/staging.

### Changed

- `react-resizable-panels` 2.1.9 → 4.12.2 and the `src/components/ui/resizable.tsx`
  wrapper adapted to it: `PanelGroup` → `Group`, `PanelResizeHandle` →
  `Separator`, the group's `direction` prop → `orientation`, and the
  orientation-dependent handle styles moved from the removed
  `data-panel-group-direction` attribute to `aria-orientation`. Panel sizes in
  `DicomViewer` are now percentage strings — v4 reads bare numbers as pixels.
  The Dependabot ignore entry for the package is gone (#198).
- Drained the Dependabot backlog: the Radix UI set, lucide-react,
  @hookform/resolvers, esbuild, the Cornerstone 4.x set, FastAPI, uvicorn,
  ruff, mypy, fakeredis, mkdocs-material, the segmenter version floors, and
  actions/setup-python + setup-node to v7.
- Raised the npm `open-pull-requests-limit` back to 10 now that the backlog is
  drained.
- Renamed the package from the `vite_react_shadcn_ts` scaffold name to
  `radiolyze` and set an initial `0.1.0` version (was `0.0.0`).

### Security

- `docker-compose.yml` no longer defaults any credential: `POSTGRES_PASSWORD`,
  `ORTHANC_PASSWORD`, `SEGMENTER_API_KEY` and the newly forwarded
  `JWT_SECRET_KEY` are required variables (`${VAR:?…}`), so compose refuses to
  start and names the missing variable instead of silently bringing the stack
  up on the well-known `app`/`orthanc` dev credentials (#99).
- `JWT_SECRET_KEY`, `ENVIRONMENT` and `CORS_ORIGINS` now actually reach the
  backend container. Setting them in `.env` previously had no effect — compose
  read `.env` for interpolation only and never passed them through, so a
  deployment that followed `env.example` still signed auth cookies with the
  development secret (#99).
- `orthanc/entrypoint.sh` and `docker/docker-entrypoint.d/dicom-web-auth.sh`
  (the production nginx image) fail loudly on a missing password instead of
  falling back to `orthanc`/`orthanc`, so the guarantee also holds for images
  started outside compose.
