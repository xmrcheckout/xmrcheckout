#!/bin/sh
set -e

normalize_address() {
  value="$1"
  if [ -z "$value" ]; then
    return
  fi
  case "$value" in
    http://*)
      value="${value#http://}"
      ;;
    https://*)
      value="${value#https://}"
      ;;
  esac
  value="${value%%/*}"
  printf '%s' "$value"
}

args=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --daemon-address)
      shift
      normalized="$(normalize_address "$1")"
      args="$args --daemon-address $normalized"
      ;;
    --daemon-address=*)
      value="${1#--daemon-address=}"
      normalized="$(normalize_address "$value")"
      args="$args --daemon-address=$normalized"
      ;;
    *)
      args="$args $1"
      ;;
  esac
  shift
done

# shellcheck disable=SC2086
exec $args
