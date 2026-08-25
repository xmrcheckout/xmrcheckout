#!/bin/sh
set -eu

wallet_dir="${1:-/wallets}"
if [ ! -d "$wallet_dir" ]; then
  echo "wallet cache check failed: wallet directory does not exist" >&2
  exit 1
fi
chmod 700 "$wallet_dir"

quarantine_dir=""
repaired=0

for keys_file in "$wallet_dir"/user-*.keys; do
  [ -e "$keys_file" ] || continue
  if [ ! -s "$keys_file" ]; then
    echo "wallet cache check failed: an empty keys file requires operator review" >&2
    exit 1
  fi

  cache_file="${keys_file%.keys}"
  if [ ! -f "$cache_file" ] || [ -s "$cache_file" ]; then
    continue
  fi

  if [ -z "$quarantine_dir" ]; then
    quarantine_dir="$wallet_dir/.quarantine/$(date -u +%Y%m%dT%H%M%SZ)-$$"
    mkdir -p "$quarantine_dir"
    chmod 700 "$wallet_dir/.quarantine" "$quarantine_dir"
  fi

  mv "$cache_file" "$quarantine_dir/"
  for suffix in .new .unportable; do
    artifact="${cache_file}${suffix}"
    if [ -f "$artifact" ] && [ ! -s "$artifact" ]; then
      mv "$artifact" "$quarantine_dir/"
    fi
  done
  repaired=$((repaired + 1))
done

echo "wallet cache check complete: quarantined_zero_caches=$repaired"
