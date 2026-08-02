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
- `src/lib/date.ts`: the date and time formatting helpers, moved out of
  `src/data/mockData.ts` (which is mock fixtures, not utilities) and extended
  with `formatShortDate`/`formatDateTime`. Every helper formats in the language
  the UI is currently showing and returns `—` for unparseable input (#117).
- `src/hooks/useDateFormat.ts`: those helpers bound to the active language, so a
  component re-renders and reformats its dates when the language changes.
- `src/i18n/__tests__/resources.test.ts`: asserts that the German and English
  resources carry the same keys in every namespace, so a translation added to
  one language cannot silently go missing in the other.
- `src/services/__tests__/apiClient.test.ts`, `reportClient.test.ts` and
  `authClient.test.ts`: the first tests for the service clients — request and
  query building, the retry/backoff on 502/503/504, the 401 path that clears
  the cached user and redirects, `content-disposition` filename parsing in the
  export paths, and the SSE parsing behind `streamImpression` (#115).
- A coverage gate: `npm run test:coverage` runs the frontend suite with
  `--coverage` and the frontend CI job now runs it instead of a bare `vitest`.
  The thresholds in `vitest.config.ts` are a floor just under current coverage,
  so a regression fails the build; they count every file under `src/` rather
  than only the ones a test imports (#115).

- `src/components/RightPanel/__tests__/GuidelinesPanel.test.tsx`: pins the
  panel's search behaviour — nothing fetched while collapsed, the findings
  context used as the opening search, one request per settled search term
  rather than one per keystroke, and previous hits kept on screen while the
  next search is in flight (#113).

### Changed

- `GuidelinesPanel` and `PromptSettings` fetch through `@tanstack/react-query`
  instead of `useEffect` plus hand-rolled loading/error state, so both get the
  retry, caching and request dedup the rest of the app already had (#113).
  `GuidelinesPanel` no longer fires a second search immediately after the first
  one lands, and `PromptSettings` keeps unsaved edits as overrides on top of
  the server state, so a background refetch cannot overwrite what someone is
  typing.
- The user-facing text in `GuidelinesPanel` goes through i18n rather than German
  literals (#117).
- Dates and times are no longer formatted with a hardcoded `de-DE` locale in
  `FindingsPanel`, `ReportDiffPanel`, `Dashboard`, `Monitoring` (chart axis and
  snapshot table) and the former `mockData` helpers — they follow the selected
  UI language, which previously stayed German whatever the language setting
  said (#117).
- `ReportDiffPanel` and `AnnotationPanel` render their user-facing text through
  i18n instead of German literals; `ReportDiffPanel` held a `useTranslation`
  handle it never used (#117).
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
