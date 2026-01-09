#!/usr/bin/env bash
set -euo pipefail

: "${POSTGRES_HOST:?}"
: "${POSTGRES_USER:?}"
: "${POSTGRES_PASSWORD:?}"
: "${POSTGRES_DB:?}"

backup_retention_days="${BACKUP_RETENTION_DAYS:-7}"

export PGPASSWORD="$POSTGRES_PASSWORD"

backup_dir="/backups"
timestamp="$(date +%Y%m%d_%H%M%S)"
backup_path="${backup_dir}/${POSTGRES_DB}_${timestamp}.dump"

mkdir -p "$backup_dir"

pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -f "$backup_path"

find "$backup_dir" -type f -name "*.dump" -mtime "+${backup_retention_days}" -delete
