# xmrcheckout.com

Non-custodial Monero checkout software. Payments go directly from the
customer to the merchant. This project never requests spend keys and
never moves funds.

## Run the homepage

### Docker
```
docker build -t xmrcheckout-home .
docker run --rm -p 8080:80 xmrcheckout-home
```

Open `http://localhost:8080` for the homepage.

## Run the full stack locally (Docker Compose)

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
- Monero view-only wallet settings (`MONERO_WALLET_RPC_*`) and daemon URL
- `MONERO_DAEMON_URL` if you use your own daemon

3. Choose a wallet-rpc target and provision view-only wallets:
- Use the bundled wallet-rpc containers:
  - Set `MONERO_WALLET_RPC_URLS=http://wallet-rpc-reconciler-1:18083,http://wallet-rpc-reconciler-2:18083,http://wallet-rpc-reconciler-3:18083`
- Or point to an external wallet-rpc service:
  - Set `MONERO_WALLET_RPC_URLS`, `MONERO_WALLET_RPC_USER`,
    `MONERO_WALLET_RPC_PASSWORD`, and `MONERO_WALLET_RPC_WALLET_PASSWORD`

4. Start the stack:
```
docker compose up --build -d
```

### Donations (disabled by default)

Donation endpoints and UI are off by default for self-hosted deployments.
To enable donations:
- Set `DONATIONS_ENABLED=true`
- Set `FOUNDER_PAYMENT_ADDRESS` and `FOUNDER_VIEW_KEY`

The UI uses the same flag (via Compose), so `/donate` stays unavailable
unless donations are explicitly enabled.

## Run the API (Python)

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
