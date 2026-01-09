# xmrcheckout.com

Non-custodial Monero checkout software for merchants. Payments go directly from the customer to the merchant wallet.

This project is intentionally conservative by design:
- It never requests or stores private spend keys.
- It never signs transactions.
- It never moves funds on behalf of users.
- View-only access (wallet address + private view key) is the maximum trust boundary.

## Contents

- [What it does](#what-it-does)
- [Trust model](#trust-model)
- [Repository layout](#repository-layout)
- [Screenshots](#screenshots)
- [Quick start](#quick-start)
- [Self-hosted deployment](#self-hosted-deployment-docker-compose)
- [Development (API)](#development-api-python)

## What it does

At a high level:
1. Your integration creates an invoice (defined in XMR).
2. The UI shows payment instructions (address + amount).
3. The system observes the chain using view-only wallet access to detect payments and update invoice status.
4. Optional integrations (for example webhooks) can be used to trigger your internal order flow.

What it does not do:
- It does not provide custody, refunds, or any fund-moving automation.
- It does not act as a financial intermediary.
- It does not touch fiat rails in the core system.

## Trust model

- Funds always move from the customer to the merchant wallet; xmrcheckout only observes the chain to detect payments.
- The maximum permission level is view-only wallet access (wallet address + private view key).
- If any configuration or integration implies spend authority, treat it as a misconfiguration.

## Repository layout

- `ui/`: web UI
- `api/`: API service (Python)
- `docker-compose.yml`: local stack and self-hosted deployment
- `nginx/`: reverse proxy / TLS termination for local HTTPS

## Quick start

### Homepage only (Docker)

```
docker build -t xmrcheckout-home .
docker run --rm -p 8080:80 xmrcheckout-home
```

Open `http://localhost:8080`.

### Full stack (Docker Compose)

```
docker compose up --build
```

Open `https://localhost` for the UI (HTTP redirects to HTTPS).
The API runs on `http://127.0.0.1:8000` and Postgres on port `5432`.

## Self-hosted deployment (Docker Compose)

1. Copy the environment template and fill in required values:

```
cp .env.example .env
```

2. Set required values in `.env`:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `API_KEYS`, `API_KEY_ENCRYPTION_KEY`
- `SITE_URL` (public URL for the UI)
- Monero view-only wallet settings (`MONERO_WALLET_RPC_*`)
- `MONERO_DAEMON_URL` (choose one of the options below)

3. Choose a Monero daemon source:
- **Use a third-party daemon (default):**
  - Leave `MONERO_DAEMON_URL` as-is (the default points at a public Monero daemon).
- **Run your own daemon via Docker Compose:**
  - Set `MONERO_DAEMON_URL=http://monerod:18081`
  - Start the stack with the `local-daemon` profile (see step 5)
  - Note: initial sync can take a long time and uses significant disk; payment detection won’t be reliable until the daemon is synced.

4. Choose a wallet-rpc target and provision view-only wallets:
- Use the bundled wallet-rpc containers:
  - Set `MONERO_WALLET_RPC_URLS=http://wallet-rpc-reconciler-1:18083,http://wallet-rpc-reconciler-2:18083,http://wallet-rpc-reconciler-3:18083`
- Or point to an external wallet-rpc service:
  - Set `MONERO_WALLET_RPC_URLS`, `MONERO_WALLET_RPC_USER`, `MONERO_WALLET_RPC_PASSWORD`, and `MONERO_WALLET_RPC_WALLET_PASSWORD`

5. Start the stack:

```
docker compose up --build -d
```

If you’re running the bundled `monerod` service:

```
docker compose --profile local-daemon up --build -d
```

### Optional: Postgres backups (disabled by default)

This repository includes an optional `db-backup` service that runs `pg_dump` hourly and writes backups to `./backups/postgres` on the host.

Enable it by starting Compose with the `db-backup` profile:

```
docker compose --profile db-backup up --build -d
```

Retention defaults to 7 days. To override:
- Set `BACKUP_RETENTION_DAYS` in `.env`

### Optional: donations (disabled by default)

Donation endpoints and UI are off by default for self-hosted deployments.
To enable donations:
- Set `DONATIONS_ENABLED=true`
- Set `FOUNDER_PAYMENT_ADDRESS` and `FOUNDER_VIEW_KEY`

The UI uses the same flag (via Compose), so `/donate` stays unavailable unless donations are explicitly enabled.

## Development (API, Python)

1. Set environment variables (see `api/.env.example`):

```
export DATABASE_URL=postgresql://xmrcheckout:xmrcheckout@localhost:5432/xmrcheckout
export API_KEYS=change-me-1
```

2. Install dependencies:

```
python -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
```

3. Start the API:

```
uvicorn api.app.main:app --reload
```

The API listens on `http://127.0.0.1:8000`.
