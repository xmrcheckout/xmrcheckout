#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"

if ! python -m pip_audit --version >/dev/null 2>&1; then
  echo "pip-audit is required: python -m pip install pip-audit" >&2
  exit 1
fi

python -m pip_audit -r "$ROOT_DIR/api/requirements.txt" --progress-spinner off
npm --prefix "$ROOT_DIR/ui" audit --omit=dev
npm --prefix "$ROOT_DIR/ui" audit
