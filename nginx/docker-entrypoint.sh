#!/bin/sh
set -eu

cert_dir="/etc/nginx/certs"
cert_path="${cert_dir}/dev.crt"
key_path="${cert_dir}/dev.key"

if [ ! -f "$cert_path" ] || [ ! -f "$key_path" ]; then
  mkdir -p "$cert_dir"
  rm -f "$cert_path" "$key_path"
  openssl req \
    -x509 \
    -nodes \
    -newkey rsa:2048 \
    -days 365 \
    -keyout "$key_path" \
    -out "$cert_path" \
    -subj "/CN=localhost"
fi

exec "$@"
