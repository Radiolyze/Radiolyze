#!/usr/bin/env bash
#
# ruff is pinned three times: for the backend CI job and local runs
# (backend/requirements-dev.txt), for the segmenter CI job
# (services/segmenter/requirements-dev.txt), and for the pre-commit hook
# (.pre-commit-config.yaml). Dependabot updates them from two different
# ecosystems (pip and pre-commit) and the two pip pins live in separate
# requirements files, so the bumps arrive as separate PRs and can land days
# apart. A formatter version skew means the hook -- or one service's job --
# writes a file that another then rejects. This asserts they stay in lockstep.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

read_requirements_pin() {
  sed -n 's/^ruff==\([0-9][^[:space:]]*\).*/\1/p' "${repo_root}/$1"
}

backend_version="$(read_requirements_pin backend/requirements-dev.txt)"
segmenter_version="$(read_requirements_pin services/segmenter/requirements-dev.txt)"
precommit_version="$(
  awk '
    /astral-sh\/ruff-pre-commit/ { found = 1; next }
    found && /rev:/ { sub(/^.*rev:[[:space:]]*v?/, ""); print; exit }
  ' "${repo_root}/.pre-commit-config.yaml"
)"

if [[ -z "${backend_version}" ]]; then
  echo "Could not find a 'ruff==' pin in backend/requirements-dev.txt" >&2
  exit 1
fi
if [[ -z "${segmenter_version}" ]]; then
  echo "Could not find a 'ruff==' pin in services/segmenter/requirements-dev.txt" >&2
  exit 1
fi
if [[ -z "${precommit_version}" ]]; then
  echo "Could not find the ruff-pre-commit 'rev:' in .pre-commit-config.yaml" >&2
  exit 1
fi

if [[ "${backend_version}" != "${segmenter_version}" || "${backend_version}" != "${precommit_version}" ]]; then
  cat >&2 <<EOF
ruff pins are out of sync:

  backend/requirements-dev.txt              ruff==${backend_version}
  services/segmenter/requirements-dev.txt   ruff==${segmenter_version}
  .pre-commit-config.yaml                   rev: v${precommit_version}

Dependabot proposes these as separate PRs (two pip files and pre-commit), so
they have to be merged together. Set all three to the same version so the
pre-commit hook and both CI jobs format identically.
EOF
  exit 1
fi

echo "ruff pin in sync: ${backend_version}"
