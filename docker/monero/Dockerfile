FROM debian:bookworm-slim

ARG MONERO_VERSION=0.18.5.3
ARG MONERO_SHA256_X64=3333d0e04c9cbe3023e7e2b6dd369c407f36bb8df5b05fb0a19d7685b3d56dfc
ARG MONERO_SHA256_ARMV8=1490114f795ad2f67f57bc8d167c3e2539e9f173fc46f02f70ef4abf685f8c66

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl bzip2 \
  && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  arch="$(dpkg --print-architecture)"; \
  if [ "$arch" = "amd64" ]; then \
    monero_arch="x64"; \
    monero_sha256="$MONERO_SHA256_X64"; \
  elif [ "$arch" = "arm64" ]; then \
    monero_arch="armv8"; \
    monero_sha256="$MONERO_SHA256_ARMV8"; \
  else \
    echo "Unsupported architecture: $arch" >&2; \
    exit 1; \
  fi; \
  curl -fsSL -o /tmp/monero.tar.bz2 \
    "https://downloads.getmonero.org/cli/monero-linux-${monero_arch}-v${MONERO_VERSION}.tar.bz2"; \
  echo "${monero_sha256}  /tmp/monero.tar.bz2" | sha256sum -c -; \
  tar -xjf /tmp/monero.tar.bz2 -C /tmp; \
  cp /tmp/monero-*/monerod /usr/local/bin/; \
  cp /tmp/monero-*/monero-wallet-rpc /usr/local/bin/; \
  rm -rf /tmp/monero* /tmp/monero.tar.bz2

COPY entrypoint.sh /usr/local/bin/monero-wallet-rpc-entrypoint
COPY repair-wallet-caches.sh /usr/local/bin/repair-wallet-caches
RUN chmod +x /usr/local/bin/monero-wallet-rpc-entrypoint /usr/local/bin/repair-wallet-caches

RUN groupadd --gid 10001 monero \
  && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin monero \
  && install -d -o 10001 -g 10001 -m 0700 /data

EXPOSE 18081 18083

USER 10001:10001

ENTRYPOINT ["/usr/local/bin/monero-wallet-rpc-entrypoint"]
