FROM debian:bookworm-slim

ARG MONERO_VERSION=0.18.4.4

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl bzip2 \
  && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  arch="$(dpkg --print-architecture)"; \
  if [ "$arch" = "amd64" ]; then \
    monero_arch="x64"; \
  elif [ "$arch" = "arm64" ]; then \
    monero_arch="armv8"; \
  else \
    echo "Unsupported architecture: $arch" >&2; \
    exit 1; \
  fi; \
  curl -fsSL -o /tmp/monero.tar.bz2 \
    "https://downloads.getmonero.org/cli/monero-linux-${monero_arch}-v${MONERO_VERSION}.tar.bz2"; \
  tar -xjf /tmp/monero.tar.bz2 -C /tmp; \
  cp /tmp/monero-*/monerod /usr/local/bin/; \
  cp /tmp/monero-*/monero-wallet-rpc /usr/local/bin/; \
  rm -rf /tmp/monero* /tmp/monero.tar.bz2

COPY entrypoint.sh /usr/local/bin/monero-wallet-rpc-entrypoint
RUN chmod +x /usr/local/bin/monero-wallet-rpc-entrypoint

EXPOSE 18081 18083

ENTRYPOINT ["/usr/local/bin/monero-wallet-rpc-entrypoint"]
