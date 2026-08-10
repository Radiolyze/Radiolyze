# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries before this file was introduced are not backfilled — see `git log`
for the full history.

## [Unreleased]

### Added

- WebSocket heartbeat and idle disconnect (#106). `/api/v1/ws` sends
  `{"type":"ping"}` after `WS_HEARTBEAT_INTERVAL_SECONDS` (default 30) of
  silence and closes with code **4408** after `WS_IDLE_TIMEOUT_SECONDS`
  (default 120). Before this, the endpoint sat in an unbounded `receive_text()`
  loop: a half-open socket was noticed only when a broadcast happened to fail,
  and never at all on a connection nothing was broadcast to, so dead
  connections accumulated in the connection manager. A client-sent `ping` is
  answered with `pong`, so either side can drive the exchange, and `0` disables
  either half. `wsClient` answers server pings automatically and keeps
  heartbeat frames out of the application's message handlers.
- `e2e/workflow.spec.ts`: end-to-end coverage of the core clinical workflow —
  study selection, AI findings, QA and finalize (#116). Eight specs drive the
  real workspace through a network-level backend stub (`e2e/support/`), so the
  app's DICOMweb mapping, inference polling and report state all run unmodified
  without Postgres/Redis/Orthanc/vLLM. Each spec asserts both what the user
  sees and the request the UI produced.
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
- `src/pages/__tests__/Training.test.tsx`: renders the training export page in
  both languages and across a language switch. It also asserts the export
  hint's manifest path reaches the DOM inside a `<code>` element — `<Trans>`
  resolves tag names against its `components` map, and a name with no match
  renders as literal text, which a test on the resource string cannot see.
- The i18n guide documents `<Trans>` for markup inside a sentence, and how to
  pin a dynamic key with a test over every possible value. Its namespace table
  and file listing now include the `training` namespace.
- The DICOM SEG round-trip test writes a real SEG and reads it back through
  highdicom, comparing the decoded label map voxel-for-voxel with the input,
  plus cases for a slice-count mismatch and a source series stripped of the
  type 2 attributes highdicom requires. The previous test stubbed the writer or
  skipped when it was missing — the exact shape of failure #199 describes.
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

- `src/hooks/reporting/__tests__/`: 43 tests for the three hooks split out of
  `useReport` — the persisted-vs-in-memory edit paths, the inference runner's
  status transitions and failure handling (including that a 4xx is not masked by
  the impression fallback), and that a failed QA run warns rather than breaking
  the editor. The report lifecycle had no tests at all before (#115, #120).
- `src/components/RightPanel/__tests__/GuidelinesPanel.test.tsx`: pins the
  panel's search behaviour — nothing fetched while collapsed, the findings
  context used as the opening search, one request per settled search term
  rather than one per keystroke, and previous hits kept on screen while the
  next search is in flight (#113).

### Deprecated

- The `?token=` query parameter on `/api/v1/ws` (#106). Browsers authenticate
  with the HttpOnly auth cookie; the query parameter writes the JWT into proxy
  and access logs. It keeps working for non-browser clients, but every use is
  now logged as a warning naming the user and client address, and a deployment
  whose clients have migrated can reject it with `WS_ALLOW_QUERY_TOKEN=false`.

### Changed

- `src/pages/History.tsx` (600 lines) is split along the same lines as
  `Batch.tsx` (#120): the audit-event mapping moves to
  `src/services/auditMapping.ts`, fetching and study-lookup enrichment to
  `useAuditLog`, the filters and stats to `useHistoryFilters`, and the markup to
  `HistoryStatsGrid`/`HistoryFilterBar`/`HistoryTimeline`, leaving the page at 66
  lines that compose them. Behaviour is unchanged; what the split buys is that
  the metadata fallback chains, the study enrichment and the date grouping are
  now pure functions with tests, where before they could only be reached by
  rendering the page.
- The last three hand-rolled fetchers in the `ReportWorkspace` path —
  `useDicomWebQueue`, `usePriorStudies` and `usePriorReports` — fetch through
  react-query instead of a `useEffect` + `useState` triple with its own
  cancellation flag (#113). Their exported signatures are unchanged, so every
  caller is untouched; what changes is that the requests now get the
  `QueryClient` defaults from `src/App.tsx` (30 s `staleTime`, one retry, no
  refetch-on-focus), are deduplicated across components, and are cached.
  Concretely: the study queue no longer loads exactly once per mount, and the
  prior-study/prior-report queries are keyed on the patient rather than on the
  study or report, so moving between a patient's studies re-filters cached data
  instead of re-querying Orthanc and re-resolving every series. This was the
  work #113 deferred to the `useReport` split, which has since landed.
- `useReport` (556 lines) is split into three focused hooks — `useReportMutations`
  (findings/impression/approval round trips), `useInference` (queue an AI job and
  merge its result) and `useQaChecks` — with `useReport` left as their
  composition (#120). Its return type is unchanged, so `ReportWorkspace` and
  every other caller is untouched. `generateImpression` and `analyzeImages` were
  ~110 lines of near-identical code and now share one runner. This is the split
  #113 and #115 both defer their remaining work to.
- A failed inference marks the report `inferenceStatus: "failed"` on a 4xx as
  well, where `generateImpression` previously left the previous status in place
  because the early-return for client errors sat above the status write.
  `analyzeImages` already behaved this way; both paths now agree.
- The `e2e-frontend` CI job blocks instead of running with
  `continue-on-error` (#116). It was advisory while the suite only proved that
  Playwright starts; now that it covers the core workflow and stubs every
  backend response, a failure is a regression rather than an unavailable
  service. The per-test timeout moves to 60s, since the inference specs wait
  out the WebSocket-to-polling fallback.
- Every timestamp column is `timestamptz` instead of a `String` holding ISO
  text (migration `0005_timestamps`, #102). Range queries and `ORDER BY` are
  now temporal rather than lexicographic — the old comparison only agreed with
  chronological order while every value was UTC, zero-padded and
  same-precision, so a single row written with a `+02:00` offset sorted wrong
  and drift windows counted it in the wrong period. Values are written with
  `app.utils.time.utc_now()` and read back timezone-aware in UTC on both
  PostgreSQL and SQLite. The API contract is unchanged: response timestamps
  are still ISO-8601 strings with an explicit `+00:00` offset.
- `utc_now()` moved from `app/mock_logic.py` to `app/utils/time.py` and returns
  a `datetime` rather than a string. Every timestamp write in the backend goes
  through it (#102).
- `GuidelinesPanel` and `PromptSettings` fetch through `@tanstack/react-query`
  instead of `useEffect` plus hand-rolled loading/error state, so both get the
  retry, caching and request dedup the rest of the app already had (#113).
  `GuidelinesPanel` no longer fires a second search immediately after the first
  one lands, and `PromptSettings` keeps unsaved edits as overrides on top of
  the server state, so a background refetch cannot overwrite what someone is
  typing.
- The user-facing text in `GuidelinesPanel` goes through i18n rather than German
  literals (#117).
- The segmenter's DICOM SEG writer moved from the unmaintained `pydicom-seg`
  to `highdicom`, lifting the `pydicom<3.0` ceiling (now `>=3.0.2,<4`) and
  removing the matching Dependabot `ignore` entry (#199). The public surface of
  `app/dicom_seg.py` is unchanged; the dcmqi-style JSON template gave way to
  `SegmentDescription` objects, and the retired SRT codes (`T-62000` and
  friends) are now current SCT codes. The segmenter's `/health` payload reports
  `highdicom_version` in place of `pydicom_seg_version`.
- Dates and times are no longer formatted with a hardcoded `de-DE` locale in
  `FindingsPanel`, `ReportDiffPanel`, `Dashboard`, `Monitoring` (chart axis and
  snapshot table) and the former `mockData` helpers — they follow the selected
  UI language, which previously stayed German whatever the language setting
  said (#117).
- `ReportDiffPanel` and `AnnotationPanel` render their user-facing text through
  i18n instead of German literals; `ReportDiffPanel` held a `useTranslation`
  handle it never used (#117).
- `src/i18n/__tests__/fallbacks.test.ts`: resolves every `t("key", "German
  fallback")` call site against the resources, so a key that exists nowhere
  fails a test instead of silently rendering German to English users (#117).
- `ComparisonPanel` and the recording banner in `FindingsPanel` now resolve
  their translations instead of falling through to the inline German defaults:
  the panel read `comparison.*` from the default `common` namespace, where
  those keys never existed (the `comparison` section lives in `viewer` and
  means something else), so its heading, buttons, evidence chips and trend and
  status badges rendered German — or a raw `progressed`/`worsened` identifier —
  in every language (#117).
- The Training data export page renders through i18n instead of German
  literals — it had no `useTranslation` at all: page and card headings, every
  form label, the export and manifest toasts, the manifest preview with its
  error list, and the empty state. Its keys live in a new `training` namespace
  (#117). The split slider's bound labels are interpolated from the same
  constants the slider's `min`/`max` are given, rather than spelling the
  percentages out a second time in each locale file.
- The Monitoring page renders through i18n instead of German literals — page
  title, actions, drift-warning headings, both metric cards with their row
  labels and column headers, the history charts and tooltips, the empty state
  and the snapshot table (#117). Drift alerts now show a readable metric name
  rather than the backend's raw `inference.confidence_avg` identifier.
- `react-resizable-panels` 2.1.9 → 4.12.2 and the `src/components/ui/resizable.tsx`
  wrapper adapted to it: `PanelGroup` → `Group`, `PanelResizeHandle` →
  `Separator`, the group's `direction` prop → `orientation`, and the
  orientation-dependent handle styles moved from the removed
  `data-panel-group-direction` attribute to `aria-orientation`. Panel sizes in
  `DicomViewer` are now percentage strings — v4 reads bare numbers as pixels.
  The Dependabot ignore entry for the package is gone (#198).
- Drained the Dependabot backlog a second time, as one branch rather than
  sixteen PRs each invalidating the next one's lockfile: i18next, react and
  react-dom, react-hook-form, lint-staged, fastapi, uvicorn, alembic, redis, and
  the SimpleITK and TotalSegmentator floors. globals 15 → 17 and
  eslint-plugin-react-refresh 0.4 → 0.5 are majors, but `eslint.config.js` uses
  only `globals.browser` and the `only-export-components` rule, and both survive.
- `react-router-dom` 6.30.1 → 7.18.2 with no source change. The app uses
  BrowserRouter, Routes, Route, Link, NavLink, useLocation and useNavigate, all
  re-exported unchanged; the v7 breaking changes are the former future flags
  becoming defaults, and `src/App.tsx` has no data router, loaders, actions,
  fetchers or relative splat paths for any of them to act on.
- Both `ruff` pins moved to 0.16.1 in one commit. Dependabot proposes
  `backend/requirements-dev.txt` and `.pre-commit-config.yaml` as separate PRs
  from separate ecosystems, and `scripts/check-ruff-pin-sync.sh` fails while they
  disagree — so each half sat red on the other's absence until they landed
  together. Also `pre-commit-hooks` v5 → v6, whose removed hooks this repo does
  not run.
- `tailwindcss` is held at `<4` in `.github/dependabot.yml` alongside the existing
  `tailwind-merge` entry (#197). v4 moves the PostCSS plugin to
  `@tailwindcss/postcss`, replaces the `@tailwind` directives, and retires
  `tailwindcss-animate`; without the ignore entry the bump was re-proposed weekly
  against a build it cannot pass.
- Drained the Dependabot backlog: the Radix UI set, lucide-react,
  @hookform/resolvers, esbuild, the Cornerstone 4.x set, FastAPI, uvicorn,
  ruff, mypy, fakeredis, mkdocs-material, the segmenter version floors, and
  actions/setup-python + setup-node to v7.
- Raised the npm `open-pull-requests-limit` back to 10 now that the backlog is
  drained.
- Renamed the package from the `vite_react_shadcn_ts` scaffold name to
  `radiolyze` and set an initial `0.1.0` version (was `0.0.0`).

### Removed

- `src/components/ui/calendar.tsx`, the `react-day-picker` dependency and the
  `overrides.react-day-picker.react` entry that forced v8 to accept React 19.
  The component was the package's only importer and nothing imported the
  component, so the react-day-picker 8 → 10 bump was failing typecheck on
  shadcn boilerplate that never rendered.
- `@tailwindcss/typography`. It was never added to `plugins` in
  `tailwind.config.ts` and no `prose` class exists in `src/`, so it produced no
  styles.

### Fixed

- Mesh decimation in the segmenter never ran. `Trimesh.simplify_quadric_decimation`
  is a wrapper around the optional `fast-simplification` package, which
  `services/segmenter/requirements.txt` did not declare, and it was additionally
  called with the face count in the first positional parameter — which is
  `percent`, a 0.0–1.0 ratio. Either fault alone raises, and `_decimate` catches
  every exception and returns the input mesh, so `MESH_MAX_FACES` was inert and
  the viewer was served un-decimated meshes. Both predate trimesh 5; 4.12.2 fails
  identically. `test_meshing.py` now asserts the target face count is reached, that
  Taubin smoothing moves vertices, and that `MESH_MAX_FACES` reaches the artifact —
  the previous `face_count > 0` assertion was satisfied by the fallback.
- `GET /api/v1/inference/status/{job_id}` returned 500 for every job still
  queued or started. The stuck-job check read `.tzinfo` off `queued_at`, which
  was a `str`, so it raised `AttributeError` before it could compare anything.
  Fixed by the timestamp migration above, and pinned by a test (#102).

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
