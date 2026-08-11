# Dependency Policy

How dependency updates are reviewed, which upgrades are deliberately held back, and why a green pipeline is not by itself a reason to merge.

---

## The Rule That Matters

**A green CI run is evidence, not proof.**

Radiolyze's checks catch the failures that are structural: an unresolvable
install, a renamed export, a broken test. They do not catch a dependency that
installs cleanly, type-checks cleanly, and then behaves differently at runtime.
Several of the upgrades held back below are exactly that shape.

Before merging a dependency bump, ask which of the three it is:

| Failure mode | Caught by | Example |
|---|---|---|
| Install conflict | `npm ci` / `pip install` | `@cornerstonejs/dicom-image-loader` v5 against core v4 |
| Type / API break | `npm run typecheck` | `react-resizable-panels` v4 renamed its exports |
| **Silent behaviour change** | **nothing** (until #197 added `src/lib/__tests__/utils.test.ts`) | `tailwind-merge` v3 mis-resolving Tailwind 3 classes |

The third row is the one that needs a human.

---

## What Dependabot Is Configured To Do

`.github/dependabot.yml` covers six ecosystems, weekly: npm (`/`), pip
(`/backend`, `/services/segmenter`, `/docs`), GitHub Actions, and pre-commit
hook revisions.

Two mechanisms shape what arrives:

**Groups** — packages that only resolve when they move together are bumped in a
single PR:

- `@radix-ui/*` — 27 packages that track each other
- `@cornerstonejs/*` — core, tools and dicom-image-loader share a version line
- `opentelemetry-*` — the SDK (1.4x) and instrumentation (0.6xb0) lines are
  pinned to each other; split apart, every one of them is a pip conflict
- `ruff` / `mypy` / `pytest*` — backend dev tooling
- All GitHub Actions

**Ignores** — majors that are held back on purpose. Each one has a tracking
issue, and the entry is removed when the migration lands. See the next section.

---

## Deliberately Held Back

| Package | Held at | Blocked by | Issue |
|---|---|---|---|
| `eslint` | `<10` | Upstream: `eslint-plugin-jsx-a11y` has no ESLint 10 support | [#196](https://github.com/Radiolyze/Radiolyze/issues/196) |
| `@cornerstonejs/*` | `<5` | Needs `vite.config.ts` and `scripts/bundle-cornerstone-worker.mjs` changes | [#195](https://github.com/Radiolyze/Radiolyze/issues/195) |

`tailwind-merge` was the instructive one, and is worth keeping in mind as a
pattern even though the entry is gone. Its v3 release drops Tailwind 3 support,
but it declares no `peerDependencies`, nothing about it is type-level, and no
test asserted on merged class output — so the bump installed cleanly, CI went
green, and `cn()` would have started mis-resolving class conflicts across the
whole component library, producing visual regressions with no obvious culprit.
The ignore entry existed for exactly that reason rather than as a "be careful
when reviewing" note.

Resolved in [#197](https://github.com/Radiolyze/Radiolyze/issues/197) by
migrating `tailwindcss` and `tailwind-merge` to their v4/v3 majors in one
commit. The hole that made it invisible is closed too:
`src/lib/__tests__/utils.test.ts` merges pairs of classes whose names or syntax
exist only in Tailwind 4 (`outline-hidden`, `w-(--sidebar-width)`), so a
`tailwind-merge` that predates them leaves both sides of the conflict in place
and fails the test instead of shipping.

`pydicom` in the segmenter used to be the same shape, and is worth keeping in
mind as a pattern even though the entry is gone: `pydicom-seg` capped it at
`<3`, the writer import was lazy, and the tests stubbed the writer out — so a
pydicom 3 bump would have broken DICOM SEG export at runtime with every test
still green. Resolved in [#199](https://github.com/Radiolyze/Radiolyze/issues/199)
by migrating to `highdicom`; the test now writes a real SEG and reads it back,
so the same class of breakage fails a test instead.

---

## Reviewing a Bump

**1. Classify it.**

- Patch or minor inside the current major → the checks below are usually enough.
- Major → assume a migration until proven otherwise. Read the release notes for
  a breaking-changes section before reading the diff.
- A `>=` floor bump in `services/segmenter/requirements.txt` → note that these
  are lower bounds, not pins. CI and the Dockerfile both already install the
  newest release, so raising the floor changes what is *allowed*, not what is
  installed.

**2. Run the checks the change can actually break.**

```bash
# Frontend
npm ci && npm run bundle:worker
npm run typecheck && npm run lint && npm run format:check
npm run test
npm run build          # catches bundling/chunking regressions typecheck misses

# Backend
cd backend
ruff check . && ruff format --check .
python -m pytest tests/ -v

# Segmenter
cd services/segmenter && python -m pytest tests/ -v

# Docs
python3 -m mkdocs build --strict
```

**3. Ask what has no test.** The areas CI cannot reach:

- **The DICOM viewer** — no WebGL rendering test exists. Any `@cornerstonejs/*`
  or `@kitware/vtk.js` change wants a manual pass: series loading, MPR, and the
  segmentation overlay.
- **Rendered styling** — `src/lib/__tests__/utils.test.ts` asserts that `cn()`
  resolves conflicts against the installed Tailwind's utility names, which
  catches a `tailwind-merge` out of step with `tailwindcss`. Nothing asserts on
  what the browser paints, so anything touching `tailwindcss`, `tailwind-merge`
  or `class-variance-authority` still needs a visual review of the main routes
  in both light and dark theme.
- **DICOM-SEG export** — stubbed in the segmenter tests.

**4. Keep risky bumps in their own commit** so a regression can be reverted
without unpicking the rest of a backlog drain.

---

## Pins That Need Watching

Some versions are pinned in more than one place, or in a place no check would
notice going stale:

| Pin | Where | Guard |
|---|---|---|
| `ruff`, twice | `backend/requirements-dev.txt` **and** `.pre-commit-config.yaml` | `scripts/check-ruff-pin-sync.sh`, run in CI |
| `@kitware/vtk.js` | `package.json` — an **exact** peer of `@cornerstonejs/core` and `tools` | `npm ci` fails on mismatch |
| Cornerstone worker path | `scripts/bundle-cornerstone-worker.mjs` reaches into `node_modules/@cornerstonejs/dicom-image-loader/dist/esm/` | `npm run bundle:worker` in CI |
| torch / totalsegmentator | `services/segmenter/requirements.txt` — floors only, so segmenter images are **not** reproducible across rebuilds | none |
| `fast-simplification` | `services/segmenter/requirements.txt` — an *optional* trimesh extra that `app/meshing.py` hard-depends on | `test_decimate_reaches_the_target_face_count` |

The `ruff` row is the one that bites. Dependabot sees the two pins through
different ecosystems — `pip` for `requirements-dev.txt`, `pre-commit` for the
hook rev — so it proposes them as two PRs that can land days apart. In between,
the hook and CI format with different ruff versions: the hook rewrites a file
and the pipeline then rejects it. **Merge the two ruff PRs together**; the CI
guard fails the build for as long as they disagree.

---

## When a Bump Cannot Land

Do not leave it open to be re-proposed every week. Instead:

1. Add an `ignore` entry to `.github/dependabot.yml` scoped to the blocked range
   (`versions: [">=3"]`), with a comment saying *why* — not just *that* — it is
   held.
2. Open a tracking issue describing the blocker, the migration scope, and how it
   would be verified.
3. Close the Dependabot PR with a link to the issue.
4. Add the row to the table above.

The ignore entry is removed in the same PR that performs the migration.

---

## Related

- [Contributing Guide](contributing.md)
- [Testing Guide](testing.md)
- `.github/dependabot.yml`
- `.github/workflows/ci.yml`
