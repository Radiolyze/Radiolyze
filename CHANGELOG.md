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

### Changed

- Drained the Dependabot backlog: the Radix UI set, lucide-react,
  @hookform/resolvers, esbuild, the Cornerstone 4.x set, FastAPI, uvicorn,
  ruff, mypy, fakeredis, mkdocs-material, the segmenter version floors, and
  actions/setup-python + setup-node to v7.
- Raised the npm `open-pull-requests-limit` back to 10 now that the backlog is
  drained.
- Renamed the package from the `vite_react_shadcn_ts` scaffold name to
  `radiolyze` and set an initial `0.1.0` version (was `0.0.0`).
