#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLARA_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

tarball_path="${1-}"

if [[ -n "$tarball_path" ]]; then
  if [[ ! -f "$tarball_path" ]]; then
    echo "Tarball not found at: $tarball_path" >&2
    exit 1
  fi
else
  MELD_DIR="$(cd -- "${SCRIPT_DIR}/../.." && pwd)/meld-clients-core"
  if [[ ! -d "$MELD_DIR" ]]; then
    echo "Unable to locate meld-clients-core at $MELD_DIR; pass the tarball path explicitly." >&2
    exit 1
  fi
  cd "$MELD_DIR"
  latest_tarball="$(ls -t meld-clients-core-*.tgz 2>/dev/null | head -n1 || true)"
  if [[ -z "$latest_tarball" ]]; then
    echo "No meld-clients-core tarballs found in $MELD_DIR. Run 'npm run pack-dev' there or pass the tarball path explicitly." >&2
    exit 1
  fi
  tarball_path="$MELD_DIR/$latest_tarball"
fi

echo "Installing $tarball_path"
cd "$CLARA_DIR"
npm install --no-save "$tarball_path"
