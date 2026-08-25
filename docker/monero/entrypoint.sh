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
wallet_rpc=false
wallet_dir="/wallets"
if [ "${1:-}" = "monero-wallet-rpc" ]; then
  wallet_rpc=true
fi
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
    --wallet-dir)
      shift
      wallet_dir="$1"
      args="$args --wallet-dir $wallet_dir"
      ;;
    --wallet-dir=*)
      wallet_dir="${1#--wallet-dir=}"
      args="$args --wallet-dir=$wallet_dir"
      ;;
    *)
      args="$args $1"
      ;;
  esac
  shift
done

if [ "$wallet_rpc" = true ]; then
  /usr/local/bin/repair-wallet-caches "$wallet_dir"
fi

# shellcheck disable=SC2086
exec $args
