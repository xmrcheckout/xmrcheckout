#!/usr/bin/env bash
set -euo pipefail

child_pid=""

stop() {
  if [[ -n "$child_pid" ]]; then
    kill "$child_pid" 2>/dev/null || true
  fi
  exit 0
}
trap stop INT TERM

while true; do
  now=$(date +%s)
  next_hour=$(( (now / 3600 + 1) * 3600 ))
  delay=$(( next_hour - now ))
  sleep "$delay" &
  child_pid=$!
  wait "$child_pid"
  child_pid=""

  if ! /usr/local/bin/backup.sh; then
    echo "PostgreSQL backup failed; retrying at the next scheduled hour" >&2
  fi
done
