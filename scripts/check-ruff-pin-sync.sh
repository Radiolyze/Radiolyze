#!/usr/bin/env bash
#
# ruff is pinned twice: once for CI and local runs (backend/requirements-dev.txt)
# and once for the pre-commit hook (.pre-commit-config.yaml). Dependabot updates
# each from a different ecosystem (pip and pre-commit), so the two bumps arrive
# as separate PRs and can land days apart. A formatter version skew means the
# hook writes a file that CI then rejects. This asserts they stay in lockstep.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

requirements_version="$(
  sed -n 's/^ruff==\([0-9][^[:space:]]*\).*/\1/p' "${repo_root}/backend/requirements-dev.txt"
)"
precommit_version="$(
  awk '
    /astral-sh\/ruff-pre-commit/ { found = 1; next }
    found && /rev:/ { sub(/^.*rev:[[:space:]]*v?/, ""); print; exit }
  ' "${repo_root}/.pre-commit-config.yaml"
)"

if [[ -z "${requirements_version}" ]]; then
  echo "Could not find a 'ruff==' pin in backend/requirements-dev.txt" >&2
  exit 1
fi
if [[ -z "${precommit_version}" ]]; then
  echo "Could not find the ruff-pre-commit 'rev:' in .pre-commit-config.yaml" >&2
  exit 1
fi

if [[ "${requirements_version}" != "${precommit_version}" ]]; then
  cat >&2 <<EOF
ruff pins are out of sync:

  backend/requirements-dev.txt   ruff==${requirements_version}
  .pre-commit-config.yaml        rev: v${precommit_version}

Dependabot proposes these two as separate PRs (pip and pre-commit), so they
have to be merged together. Set the ruff-pre-commit rev to
v${requirements_version} so the pre-commit hook and CI format identically.
EOF
  exit 1
fi

echo "ruff pin in sync: ${requirements_version}"
