<p align="center">
  <img src="ui/public/logo.png" width="120" alt="XMR Checkout logo" />
</p>

# XMR Checkout

[Website](https://xmrcheckout.com) · [Interactive tour](https://xmrcheckout.com/tour) · [API documentation](https://xmrcheckout.com/docs) · [Integration recipes](https://xmrcheckout.com/docs/integrations) · [Guides](https://xmrcheckout.com/guides) · [FAQ](https://xmrcheckout.com/faq)

Self-hosted Monero checkout software for merchants who want payments sent to their own wallet.

XMR Checkout is open source and self-hostable. It creates XMR invoices, shows a hosted payment page, watches for incoming transactions, and sends status updates through the API or webhooks.

It uses a wallet address and private view key to detect payments. It does not sign transactions or move funds.

## Contents

- [Who it's for](#who-its-for)
- [How it works](#how-it-works)
- [Features](#features)
  - [Invoices and hosted checkout](#invoices-and-hosted-checkout)
  - [Reusable payment links](#reusable-payment-links)
  - [In-person terminals](#in-person-terminals)
  - [Confirmations](#confirmations)
- [Guides](#guides)
- [Repository layout](#repository-layout)
- [Screenshots](#screenshots)
- [Quick start](#quick-start)
- [Self-hosted deployment (Docker Compose)](#self-hosted-deployment-docker-compose)
- [Self-hosted deployment (no Docker)](#self-hosted-deployment-no-docker)
- [Development (API, Python)](#development-api-python)
- [Translating the UI](#translating-the-ui)

## Who it's for

Use XMR Checkout when you want invoice status handled by software you control.

It fits merchants who need a hosted checkout page, teams that want API and webhook updates for an existing order flow, and operators who prefer self-hosted infrastructure.

## How it works

Funds move from the customer straight to the merchant wallet. XMR Checkout is
configured with a wallet address and private view key only; it watches for the
payment and reports what it sees.

Typical flow:
1. Your integration creates an invoice (defined in XMR).
2. The hosted page shows the customer the address, amount, QR code, and wallet URI.
3. The reconciler checks the wallet and daemon for matching incoming payments.
4. Your store reads invoice status through the API or receives webhook events.

## Features

### Invoices and hosted checkout

Create invoices from the dashboard or the [API](https://xmrcheckout.com/docs).
Each invoice gets a hosted payment page, and status changes are available
through the API and [webhooks](#webhooks). A BTCPay-compatible API is also
available for existing integrations; see the
[integration recipes](https://xmrcheckout.com/docs/integrations).

### Reusable payment links

Sell an item or take donations from a link or button on your website, without
writing API code.
[Setup guide](https://xmrcheckout.com/guides/monero-payment-buttons) · [API reference](https://xmrcheckout.com/docs)

- Create a link in **Dashboard → Payment links** with a fixed XMR amount, a fiat
  reference amount (for example 20 EUR), or an amount the customer enters. Copy
  the button HTML, or use the URL with your own button. No API key or wallet
  credential goes in the snippet.
- Visitors see a review page first. The setting *Skip review and create invoice
  automatically* opens checkout directly instead; the same browser tab then
  resumes its unpaid invoice, and *Start another purchase* creates a separate
  order.
- Fiat reference amounts become XMR invoices using an informational quote taken
  at creation time. No exchange rate or fiat outcome is guaranteed, and no
  invoice is created while the quote source is unavailable.
- Invoices from links appear in the normal invoice list and webhook events, with
  a snapshot of the link in `metadata.payment_link`. Arrange fulfilment using the
  invoice ID; a return URL does not protect a download.
- Anyone with the link can create invoices, including automated browsers.
  Creation counts against your invoice and address limits and a daily allowance
  shared by all links (`PUBLIC_PAYMENT_LINK_DAILY_LIMIT`, default 30 per rolling
  24 hours). The dashboard shows how much is left.
- Editing a link affects future invoices only. Disabling it stops new purchases;
  existing invoices stay valid and are still checked.

For API clients creating invoices from a link:

- A plain HTML form cannot detect a duplicate submission, so each submit may
  create another invoice. Don't retry an interrupted request automatically;
  creation may have succeeded.
- To retry safely, send a UUID `Idempotency-Key` header (with
  `Accept: application/json`). Save the key before sending and reuse it on every
  retry; a replay returns the original invoice without using more allowance or
  addresses. Keys belong to one payment link; never put them in a reusable URL.

### In-person terminals

Take payments at a till from a phone or tablet.
[In-person checkout guide](https://xmrcheckout.com/guides/in-person-monero-checkout) · [API reference](https://xmrcheckout.com/docs)

- Create a terminal in **Dashboard → Terminals** and open its link on the device
  at the till. The terminal key is in the link's URL fragment. *Show link* shows it again;
  *Create new link* replaces it, and the old link stops working.
- A terminal key can only create invoices, read their status, and cancel its own
  unpaid ones. It cannot read other invoices, change settings, or use the
  merchant API. Resetting the merchant API key does not change terminal links;
  disable or replace them separately.
- Terminal sales default to a 15-minute expiry and a confirmation target of 0,
  so the till shows the payment within seconds. Read
  [Confirmations](#confirmations) before taking larger amounts.
- Sales appear in the normal invoice list, CSV export, and webhook events, tagged
  with `metadata.terminal` (id, name, note). Your invoice limits and address
  capacity apply; the payment-link allowance does not.

### Confirmations

An invoice is checked until it reaches its confirmation target.
`invoice.confirmed` is then sent once and the invoice is not checked again.

With a target of 0 (the terminal default), a payment counts as confirmed as soon
as it is seen on the network, before it is in a block. With a target of 0 or 1,
a payment that later fails to confirm (for example, a double-spend) or is
removed by a chain reorganization still shows as confirmed, and no further event
is sent. Use a higher target for amounts you can't afford to lose; Monero
outputs become spendable after 10 confirmations.

## Guides

The [guides](https://xmrcheckout.com/guides) cover four common paths into the project:

- [Monero Payment Buttons](https://xmrcheckout.com/guides/monero-payment-buttons): reusable payment links, website buttons, and invoice tracking without an API integration.
- [In-Person Monero Checkout](https://xmrcheckout.com/guides/in-person-monero-checkout): terminal setup, customer payment screens, and confirmation policies.
- [How to Run a Self-Hosted Monero Checkout](https://xmrcheckout.com/guides/self-hosted-monero-checkout): deployment, view-only wallet setup, invoice pages, and safe payment detection.
- [Integrating the Monero Payment API and Webhooks](https://xmrcheckout.com/guides/monero-payment-api-webhooks): invoice creation, public status polling, webhook verification, and integration examples.

## Repository layout

- `ui/`: web UI
- `api/`: API service (Python)
- `tests/`: stack checks that run against the Docker images
- `docker-compose.yml`: local stack and self-hosted deployment
- `nginx/`: optional reverse proxy / TLS termination (used by Docker Compose)

## Screenshots

Post-login UI. Addresses, subaddresses and invoice IDs are blacked out, and payment QR codes are replaced with a placeholder QR code.

### Dashboard

![Dashboard overview with invoice counts, address availability and recent invoices](screenshots/ui_dashboard.png)

### Invoices

![Invoice list with search, filters and status](screenshots/ui_invoices.png)

### Create invoice

![Create invoice dialog with an XMR amount](screenshots/create_invoice_xmr.png)

![Create invoice dialog with a fiat reference amount and its informational XMR estimate](screenshots/create_invoice_fiat.png)

![Create invoice dialog summary](screenshots/create_invoice_summary.png)

### Payment links

![Payment links list with reusable buttons for donations, products and services](screenshots/ui_payment_links.png)

### Terminals

![Terminals list for in-person checkout](screenshots/ui_terminals.png)

The terminal page on a phone or tablet at the till: the merchant enters the amount, then the customer scans the payment QR code.

<img src="screenshots/terminal_till.png" width="320" alt="Terminal page with an amount entered on the keypad and a note" /> <img src="screenshots/terminal_payment.png" width="320" alt="Terminal payment page showing the amount and a placeholder QR code for the customer to scan" />

### Public invoice page

![Public invoice page awaiting on-chain payment](screenshots/public_invoice_pending_payment.png)

## Quick start

### Full stack (Docker Compose)

```
cp .env.example .env
```

Fill in the required values in `.env` (see [step 2 below](#self-hosted-deployment-docker-compose)): at least
`API_KEY_ENCRYPTION_KEY`, the wallet RPC credentials, and `MONERO_DAEMON_URL`. Generate the encryption key with:

```
python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

Then start the stack:

```
docker compose up --build
```

Open `https://localhost` for the UI (HTTP redirects to HTTPS).
This starts the reconciler and the bundled wallet-rpc shards, so payment
detection is available once the configured Monero daemon and wallets are
synced.
In the default Compose configuration, only `nginx` is published to the host. The API, Postgres, and wallet-rpc services are reachable only inside the Docker network.
If you prefer not to run `nginx`, you can publish `ui` and `api` ports directly instead (you will also need to serve `qr/` at `/qr/` on your site URL).

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
- `MONERO_DAEMON_URL` (choose one of the options in step 3)

Optional settings (defaults in brackets):
- `SIGNUP_ENABLED` (`true`) controls whether a wallet without an existing
  merchant record can connect. If the instance is only for you, connect your
  own wallet once, then set it to `false` and restart the API. Existing
  merchants can always log in.
- `INVOICE_DEFAULT_EXPIRY_HOURS` (`1`): how long a new invoice stays open when
  the request does not set its own expiry.
- `LATE_PAYMENT_LOOKBACK_HOURS` (`48`) keeps recently expired invoices eligible
  for late-payment detection. After an outage, reconciliation temporarily
  widens this window from the last fully successful cycle so an availability
  gap does not create a blind spot.
- Per-user invoice limits: `INVOICE_ACTIVE_LIMIT` (`100` active invoices) and
  `INVOICE_CREATION_RATE_LIMIT` (`60` creations) per
  `INVOICE_CREATION_RATE_WINDOW_SECONDS` (`60`). These checks are atomic across
  API workers; raise them deliberately for higher-volume integrations.
- `PAYMENT_LINK_EXPIRY_MINUTES` (`30`, allowed `1`-`1440`): how long invoices
  created from payment links stay open. Late payments to them are still
  detected within `LATE_PAYMENT_LOOKBACK_HOURS`.
- `PUBLIC_PAYMENT_LINK_DAILY_LIMIT` (`30`): successful public payment-link
  creations per rolling 24 hours, across all of a merchant's links. Nginx also
  limits the public creation endpoint to 6 requests per minute per client IP
  (burst 3). A malicious visitor can use up the allowance, and raising it does
  not enlarge the [address pool](#invoice-address-reuse).
- `TERMINAL_RECONCILE_INTERVAL_SECONDS` (`5`): between full reconciliation
  cycles, how often the reconciler refreshes wallets and checks open invoices.
  It opens a wallet for this only when the merchant has an open terminal sale;
  other merchants' open invoices are included only while their wallet is
  already open, so they cost no extra wallet switches. Each refresh is one
  wallet-rpc call per merchant checked; raise it if wallet-rpc load matters
  more than speed.

3. Choose a Monero daemon (`MONERO_DAEMON_URL` is required; the stack will not
   start without it):
- The view-only wallet trusts the blocks the daemon reports. A hostile daemon, or
  anyone on the network path to it, can show payments that never happened. Use a
  daemon you run or trust.
- **Run your own daemon via Docker Compose (recommended):**
  - Keep `MONERO_DAEMON_URL=http://monerod:18081` (the `.env.example` value)
  - Start the stack with the `local-daemon` profile (see step 5)
  - Note: initial sync can take a long time and uses significant disk; payment detection won’t be reliable until the daemon is synced.
- **Use a daemon you run or trust elsewhere:**
  - Set `MONERO_DAEMON_URL` to its URL. wallet-rpc does not check the daemon's
    TLS certificate in this setup, so HTTPS alone does not make an untrusted
    daemon or network path safe.

4. Choose a wallet-rpc target and provision view-only wallets:
- Use the bundled wallet-rpc containers:
  - Set `MONERO_WALLET_RPC_URLS=http://wallet-rpc-reconciler-1:18083,http://wallet-rpc-reconciler-2:18083,http://wallet-rpc-reconciler-3:18083`
  - The bundled shards and reconciler start by default with the stack.
  - Each container uses its own deterministic wallet shard under
    `./wallets/reconciler-1`, `./wallets/reconciler-2`, or
    `./wallets/reconciler-3`. Keep the URL ordering stable because it defines
    which shard owns each view-only wallet.
- Or point to an external wallet-rpc service:
  - Set `MONERO_WALLET_RPC_URLS`, `MONERO_WALLET_RPC_USER`, `MONERO_WALLET_RPC_PASSWORD`, and `MONERO_WALLET_RPC_WALLET_PASSWORD`
  - The reconciler uses the configured external URLs. The bundled shards may
    remain running but are not selected for invoice detection.

5. Start the stack with the bundled `monerod` service:

```
docker compose --profile local-daemon up --build -d
```

This starts the API, UI, reconciler, bundled wallet-rpc shards, and `monerod`.

If you use a daemon outside this stack:

```
docker compose up --build -d
```

### Invoice address reuse

Each merchant uses a pool of up to 199 invoice subaddresses (indices 1-199) in
account 0, all within the default range every Monero wallet watches, so
merchants never need to raise their wallet's subaddress lookahead.

- Never-issued addresses are used first. An address is reused only after all
  its previous invoices are confirmed or expired and a cooldown has passed.
- Archiving an invoice does not release its address. Pending or
  payment-detected invoices keep reserving theirs until reconciliation closes
  them.
- `SUBADDRESS_REUSE_COOLDOWN_SECONDS` sets the cooldown (default three days,
  `259200`). It must be longer than `LATE_PAYMENT_LOOKBACK_HOURS` so an address
  is never reused while its previous invoice is still watched for late
  payments.
- When every address is reserved or cooling down, invoice creation returns HTTP
  429 with `Retry-After`. Reuse also needs a fresh view-only wallet snapshot;
  if that fails, creation returns HTTP 503 and no invoice is made.
- A genuinely new late or repeated payment intended for an older invoice can
  still be mistaken for the new one. The cooldown reduces this risk but cannot
  remove it. A new invoice, including one from a payment link, does not
  guarantee a never-used address.

Authenticated merchants can inspect the pool with
`GET /api/core/subaddresses/status`; it reads local records only and never
contacts wallet RPC or consumes quota. Allocation failures carry a `code`
(`pool_exhausted`, `allocation_contention`, or `snapshot_failed`) and a
`diagnostic_id` for the correlated operator logs. The
[self-hosting guide](https://xmrcheckout.com/guides/self-hosted-monero-checkout)
covers the conceptual walkthrough.

### Webhooks

Webhook destinations must use HTTPS and resolve exclusively to public IP
addresses; loopback, private, link-local, and other special-use destinations are
rejected, including at redirect hops. This applies to both the native and
BTCPay-compatible APIs.

Webhooks found during payment detection are queued and sent by a separate
delivery loop in the reconciler, usually within seconds, so a slow merchant
server never delays detection. Failed deliveries (no response or HTTP 400 and
above) are retried up to six times (after 1 minute, 5 minutes, 30 minutes,
2 hours, 6 hours, and 24 hours), each attempt recorded in webhook history; a
manual redelivery cancels the pending retry. Retries stop if the webhook is
deleted, disabled, or unsubscribed from the event (BTCPay-compatible webhooks
retry only when `automaticRedelivery` is enabled).

Outgoing webhooks can optionally use an authenticated relay to keep the server
IP private from recipients (off by default). Set `WEBHOOK_RELAY_ENABLED=true`, an
HTTPS `WEBHOOK_RELAY_URL`, and a `WEBHOOK_RELAY_TOKEN` of at least 32 characters;
the API then POSTs each delivery to the relay as a JSON envelope (target URL,
base64 body, selected headers, timeout) with the token as a bearer credential.

When `invoice.confirmed` is sent depends on the invoice's
[confirmation target](#confirmations).

### Upgrading

New tables (such as `subaddress_allocations`, `snapshot_status` and the
payment-link tables) are added at API startup and leave existing data alone.
When upgrading, deploy the API before the reconciler and UI, then rebuild and
restart; do not run an older reconciler against a newer API.

To roll back payment links, disable the links and restore the preceding images;
the added tables and invoice records can stay.

Late-payment timing uses the on-chain time cumulative transfers first reach the
invoice amount. After an upgrade you can review and repair stored timing with
the reconciler's idempotent maintenance command (omit `--apply` to preview):

```
docker compose exec -T reconciler python -m app.reclassify_invoice_timing
docker compose exec -T reconciler python -m app.reclassify_invoice_timing --apply
```

### Troubleshooting first payment detection

If an invoice stays at `0` confirmations or never moves out of `Awaiting payment`, check these in order:

1. Open the dashboard overview and confirm:
- `Wallet RPC` shows `ok`
- `Daemon` shows `connected`
- `Current daemon height` is visible and keeps increasing
- `Last successful reconcile` is recent

2. Open System health and confirm the wallet RPC, daemon, block height, and reconciliation indicators are healthy. If block height is unavailable, the node path is broken before invoice detection can work.

3. If the bundled wallet-rpc containers keep restarting, inspect their logs:

```
docker compose logs wallet-rpc-reconciler-1
docker compose logs wallet-rpc-reconciler-2
docker compose logs wallet-rpc-reconciler-3
```

Common causes:
- wrong `MONERO_WALLET_RPC_WALLET_PASSWORD`
- wallet cache file does not match the `.keys` file
- daemon URL is unreachable from the wallet-rpc containers

At startup, each bundled wallet-rpc container checks its own shard for a
zero-byte wallet cache with a valid matching `.keys` file. It moves only the
damaged cache and temporary artifacts into a timestamped `.quarantine`
directory so the cache can be rebuilt without deleting view-only keys.

4. If you are running the bundled `monerod`, check whether it is synced:

```
docker compose logs monerod
```

Initial sync can take a long time. Payment detection is not reliable until the daemon is caught up.

5. If the reconciler is not reporting a recent successful scan, inspect the API and reconciler logs:

```
docker compose logs api
docker compose logs reconciler
```

The reconciler is what updates invoice detection and confirmations. If it is
down or degraded, invoices will not reliably advance even when wallet-rpc and
the daemon are reachable. The public system-status endpoint reports attempted,
successful, and failed invoice checks from the latest cycle.

Each invoice records its last successful check. Buyers only see "Payment
checking is delayed" when the reconciler is down or their own invoice has not
been checked successfully for 5 minutes. The merchant dashboard uses the
authenticated `GET /api/core/system/status`, which reports degraded and check
counts for that merchant's invoices only; the public endpoint above still
describes all merchants and is meant for operators. Expired invoices stay in the late-payment
check set until one check succeeds after their late-payment window ends.

### Optional: Postgres backups (disabled by default)

This repository includes an optional `db-backup` service that runs `pg_dump` hourly and writes backups to `./backups/postgres` on the host.

Enable it by starting Compose with the `db-backup` profile:

```
docker compose --profile db-backup up --build -d
```

Retention defaults to 7 days. To override:
- Set `BACKUP_RETENTION_DAYS` in `.env`

### Optional: donation link (off by default)

Donations use an ordinary payment link. To show a "Donate" link in the header and footer:
- Connect your wallet and create a payment link with "Customer enters the amount"
- Set `DONATION_LINK` to its path, for example `DONATION_LINK=/pay/<token>`, or to a full `https://` URL, then rebuild the UI. Any other value leaves donations off

`/donate` then redirects to that payment link. Without `DONATION_LINK`, `/donate` is not found and no "Donate" link is shown.

## Self-hosted deployment (no Docker)

This section describes running the services directly on a host (or VMs) without Docker.

You will run:
- Postgres (external service)
- API (`gunicorn` / `uvicorn`)
- Reconciler worker (a separate process)
- UI (Next.js)
- A reverse proxy is optional, but strongly recommended for TLS, serving `/qr/`, and providing a single origin for UI + API.

### 1. Install prerequisites

- Postgres 16+
- Python 3.12+
- Node.js 24 LTS (for the UI)
- A Monero daemon endpoint (`MONERO_DAEMON_URL`) and at least one `monero-wallet-rpc` instance reachable by the API

### 2. Configure environment variables

Start from `.env.example` and adjust for your host. For non-Docker deployments you will typically set:
- `DATABASE_URL=postgresql://...@127.0.0.1:5432/...`
- `QR_STORAGE_DIR` to a persistent directory on disk (for example `/var/lib/xmrcheckout/qr`)
- `SITE_URL` to your public URL (for example `https://example.com`)
- `API_BASE_URL` for the UI:
  - If using a reverse proxy that routes `/api/` to the API on the same origin, set `API_BASE_URL=https://example.com`
  - If not using a reverse proxy, set `API_BASE_URL=http://127.0.0.1:8000` (see the notes in step 6)

If you need a new `API_KEY_ENCRYPTION_KEY` value:

```
python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

### 3. Create the Postgres database

Create a database and user matching your `DATABASE_URL`. On first startup, the API will create tables automatically.

### 4. Run the API

```
python -m venv api/.venv
api/.venv/bin/pip install -r api/requirements.txt

# Export env vars (or use your process manager to load them)
set -a
source .env
set +a

api/.venv/bin/gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 -w "${GUNICORN_WORKERS:-2}" --chdir api
```

### 5. Run the reconciler worker

Run this as a separate long-running process (same environment variables as the API):

```
set -a
source .env
set +a

api/.venv/bin/python -m app.reconciler
```

### 6. Build and run the UI

```
cd ui
npm ci

# Optional but recommended to keep these explicit in non-Docker deployments
export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000}"
export NEXT_PUBLIC_SITE_URL="${SITE_URL:-http://127.0.0.1:3000}"
export NEXT_PUBLIC_DONATION_LINK="${DONATION_LINK:-}"

npm run build
npm prune --omit=dev
npm run start -- -p 3000 -H 127.0.0.1
```

Notes:
- The UI makes some in-browser requests to `/api/...` on the same origin. In production, prefer a reverse proxy that serves the UI and forwards `/api/` to the API.
- The QR PNGs are written to `QR_STORAGE_DIR` and must be reachable at `https://<your-site>/qr/<invoice_id>.png`.

### Optional: reverse proxy (Nginx)

Nginx is optional. Any reverse proxy that can:
- route `/api/` to the API,
- route `/` to the UI,
- and serve the QR directory at `/qr/`

is fine.

Example (adjust `server_name`, TLS, and paths to match your host):

```
server {
  listen 443 ssl;
  server_name example.com;

  # ssl_certificate ...;
  # ssl_certificate_key ...;

  location /api/ {
    proxy_pass http://127.0.0.1:8000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /qr/ {
    alias /var/lib/xmrcheckout/qr/;
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  location / {
    proxy_pass http://127.0.0.1:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Development (API, Python)

1. Set environment variables (see `api/.env.example`):

```
export DATABASE_URL=postgresql://xmrcheckout:xmrcheckout@localhost:5432/xmrcheckout
export API_KEYS=change-me-1
export API_KEY_ENCRYPTION_KEY=<a Fernet key; see "If you need a new API_KEY_ENCRYPTION_KEY value" above>
```

2. Install dependencies:

```
python -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
```

3. Start the API:

```
cd api
uvicorn app.main:app --reload
```

The API listens on `http://127.0.0.1:8000`.

### Running the tests

The API tests load files from `docker/`, so run them in the API image with that
folder mounted:

```
docker compose run --rm --no-deps -T -v "$PWD/api:/src:ro" -v "$PWD/docker:/docker:ro" -w /src --entrypoint python api -B -m unittest discover -s tests
```

Point the suite at a throwaway PostgreSQL database named `payment_link_tests`
to enable the payment-link HTTP and concurrency tests, and set
`SUBADDRESS_DATABASE_TESTS=1` for the address-allocation integration tests.
Never point these tests at a merchant database.

The payment-link browser check builds the UI, API and Nginx images and runs them
with PostgreSQL on an isolated Docker network, serving the merchant button from
a different origin. Wallet allocation, QR generation, quotes and webhooks use
fixtures, and temporary containers and networks are removed afterwards:

```sh
CHROMIUM_PATH=/path/to/chrome python3 tests/check_payment_links.py --playwright-module /path/to/playwright
```

It checks the cross-origin form POST and redirect with JavaScript disabled,
field errors with preserved input, allowance and address failures, and that the
Payment links tab does not fetch the invoice list.

UI tests (message catalogs and translations) run with `npm test` in `ui/`.

## Translating the UI

The UI picks its language from the visitor's choice in the footer language
menu (stored in the `xmrcheckout_locale` cookie), else the browser's
`Accept-Language` header, else English. Supported: English, Spanish, Russian, German, French, Portuguese, Italian, Polish, Simplified Chinese, Ukrainian and Czech.

UI text lives in `ui/messages/<locale>.json`. `en.json` is the source; any key
missing from another catalog shows in English. To add a language:

1. Copy `ui/messages/en.json` to `ui/messages/<code>.json` and translate the
   values, following `ui/messages/GLOSSARY.md`. Keep `{placeholders}` and
   `<tag>` markers unchanged.
2. Add the code to `locales` and `localeNames` in `ui/lib/i18n/config.ts`, and
   to `ui/lib/i18n/catalogs.ts`.
3. Add the language's forbidden terms to `ui/messages/GLOSSARY.md` and to
   `ui/tests/i18n.test.mjs`.
4. Run `npm test` in `ui/`.

XMR amounts, addresses, payment URIs and IDs are never localized. Amounts
always use `.` as the decimal separator so copied values stay valid in wallets.
