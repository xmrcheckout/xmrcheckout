#!/usr/bin/env bash
set -euo pipefail
umask 0077

: "${POSTGRES_HOST:?}"
: "${POSTGRES_USER:?}"
: "${POSTGRES_PASSWORD:?}"
: "${POSTGRES_DB:?}"

backup_retention_days="${BACKUP_RETENTION_DAYS:-7}"

export PGPASSWORD="$POSTGRES_PASSWORD"

backup_dir="/backups"
timestamp="$(date +%Y%m%d_%H%M%S)"
backup_path="${backup_dir}/${POSTGRES_DB}_${timestamp}.dump"
temporary_path="${backup_path}.partial"

cleanup() {
  rm -f "$temporary_path"
}
trap cleanup EXIT INT TERM

install -d -m 0700 "$backup_dir"

pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -f "$temporary_path"
pg_restore --list "$temporary_path" >/dev/null
chmod 0600 "$temporary_path"
mv "$temporary_path" "$backup_path"

find "$backup_dir" -type f -name "*.dump" -mtime "+${backup_retention_days}" -delete
find "$backup_dir" -type f -name "*.dump.partial" -mtime +1 -delete
