<p align="center">
  <img src="ui/public/logo.png" width="120" alt="XMR Checkout logo" />
</p>

# XMR Checkout

[Website](https://xmrcheckout.com) · [Interactive tour](https://xmrcheckout.com/tour) · [API documentation](https://xmrcheckout.com/docs) · [Integration recipes](https://xmrcheckout.com/docs/integrations) · [Guides](https://xmrcheckout.com/guides) · [FAQ](https://xmrcheckout.com/faq)

Self-hosted Monero checkout software for merchants who want payments sent to their own wallet.

XMR Checkout is open source and self-hostable. It creates XMR invoices, shows a hosted payment page, watches for incoming transactions, and sends status updates through the API or webhooks.

It uses a wallet address and private view key for detection. It never asks for spend keys, signs transactions, or moves funds.

## Contents

- [Who it's for](#who-its-for)
- [How it works](#how-it-works)
- [Wallet access and fund flow](#wallet-access-and-fund-flow)
- [Documentation and guides](#documentation-and-guides)
- [Repository layout](#repository-layout)
- [Screenshots](#screenshots)
- [Quick start](#quick-start)
- [Self-hosted deployment](#self-hosted-deployment-docker-compose)
- [Self-hosted deployment (no Docker)](#self-hosted-deployment-no-docker)
- [Development (API)](#development-api-python)
- [Translating the UI](#translating-the-ui)

## Who it's for

Use XMR Checkout when you want invoice status handled by software you control.

It fits merchants who need a hosted checkout page, teams that want API and webhook updates for an existing order flow, and operators who prefer self-hosted infrastructure.

## How it works

Typical flow:
1. Your integration creates an invoice (defined in XMR).
2. The hosted page shows the customer the address, amount, QR code, and wallet URI.
3. The reconciler checks the wallet and daemon for matching incoming payments.
4. Your store reads invoice status through the API or receives webhook events.

## Wallet access and fund flow

Funds move from the customer to the merchant wallet. XMR Checkout watches for the payment and reports what it sees.

Configure the app with a wallet address and private view key only. If a setup path asks for spend authority, stop and fix the configuration before using it.

## Documentation and guides

The [XMR Checkout website](https://xmrcheckout.com) includes the [interactive tour](https://xmrcheckout.com/tour), [API documentation](https://xmrcheckout.com/docs), [integration recipes](https://xmrcheckout.com/docs/integrations), [guides](https://xmrcheckout.com/guides), and [FAQ](https://xmrcheckout.com/faq).

The guides cover the two common paths into the project:

- [How to Run a Self-Hosted Monero Checkout](https://xmrcheckout.com/guides/self-hosted-monero-checkout): deployment, view-only wallet setup, invoice pages, and safe payment detection.
- [Integrating the Monero Payment API and Webhooks](https://xmrcheckout.com/guides/monero-payment-api-webhooks): invoice creation, public status polling, webhook verification, and integration examples.

## Repository layout

- `ui/`: web UI
- `api/`: API service (Python)
- `docker-compose.yml`: local stack and self-hosted deployment
- `nginx/`: optional reverse proxy / TLS termination (used by Docker Compose)

## Screenshots

Post-login UI:

### Dashboard

![Dashboard overview](screenshots/ui_dashboard.png)

### Invoices

![Invoice list and status](screenshots/ui_invoices.png)

### Create invoice

![Create invoice dialog (XMR amount)](screenshots/create_invoice_xmr.png)

![Create invoice dialog (fiat-denominated input, informational estimate)](screenshots/create_invoice_fiat.png)

![Create invoice dialog (summary)](screenshots/create_invoice_summary.png)

### Public invoice page

![Public invoice page awaiting on-chain payment](screenshots/public_invoice_pending_payment.png)

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
This starts the reconciler and the bundled wallet-rpc shards, so payment
detection is available once the configured Monero daemon and wallets are
synced.
In the default Compose configuration, only `nginx` is published to the host. The API, Postgres, and wallet-rpc services are reachable only inside the Docker network.
If you prefer not to run `nginx`, you can publish `ui` and `api` ports directly instead (you will also need to serve `qr/` at `/qr/` on your site URL).

## Self-hosted deployment (Docker Compose)

See [UI request protection](nginx/REQUEST_PROTECTION.md) for multipart validation,
POST rate limits, trusted ingress configuration, verification, and rollback.

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
- `LATE_PAYMENT_LOOKBACK_HOURS` keeps recently expired invoices eligible for
  late-payment detection (default: `48`). After an outage, reconciliation
  temporarily widens this window from the last fully successful cycle so an
  availability gap does not create a blind spot.
- Invoice creation is protected by per-user limits: `INVOICE_ACTIVE_LIMIT`
  (default `100` active invoices), `INVOICE_CREATION_RATE_LIMIT` (default
  `60` creations), and `INVOICE_CREATION_RATE_WINDOW_SECONDS` (default
  `60`). These checks are atomic across API workers; raise them deliberately
  for higher-volume integrations.

### Invoice address reuse

Each merchant uses a pool of up to 199 invoice subaddresses (indices 1-199) in
account 0. All invoice addresses are within the default range every Monero
wallet watches, so merchants never need to raise their wallet's subaddress
lookahead. Never-issued addresses are used first. After the pool has been
issued, an address can be reused only when all its previous invoices are
confirmed or expired, and three days have passed since the latest confirmation
or expiry.
Archiving an invoice does not release its address. Pending or payment-detected
invoices continue to reserve their address until reconciliation closes them.

Set `SUBADDRESS_REUSE_COOLDOWN_SECONDS` to change the three-day default
(`259200`). It must be longer than `LATE_PAYMENT_LOOKBACK_HOURS`, so an address
is never reused while its previous invoice is still watched for late payments. If every address is reserved or cooling down,
invoice creation returns HTTP 429 with `Retry-After`. When closure timestamps are
missing, the address remains unavailable. Existing merchant quotas also apply.

Reuse requires a fresh, synchronized view-only wallet snapshot. Snapshot failure
returns HTTP 503 without creating an invoice. Historical confirmed and pending
transfers are excluded from the new invoice, with a blockchain cutoff and
persistent transaction exclusions protecting subsequent checks. Old allocation
periods stop receiving updates once the address is reassigned. A genuinely new
late or repeated payment intended for an older invoice can still be mistaken for
payment of the new invoice; cooldown reduces this risk but cannot eliminate it.

These protections apply to new native, BTCPay-compatible, and donation invoices.
Existing totals, confirmations, and webhook history are not repaired or replayed.
The additive `subaddress_allocations` table is created at API startup. Deploy API
and reconciler changes together: briefly stop both services, build their images,
start the API and wait for schema initialization, then start the reconciler.
Do not run an older reconciler alongside the new API. Before rollback, stop both
services; restore a compatible version before resuming creation and detection.

Validation uses wallet fixtures and isolated PostgreSQL schemas, without sending
transactions. Run the API suite with `python -m unittest discover -s tests` from
`api/`. Set `SUBADDRESS_DATABASE_TESTS=1` to include concurrency and allocation
integration tests; the configured database role must be allowed to create and
drop temporary schemas. Tests do not use existing merchant rows.

Authenticated merchants can inspect `GET /api/core/subaddresses/status` (use
`Authorization: ApiKey …`). The response is uncached and reads local records only:
it never contacts wallet RPC, reserves an address, or consumes creation quotas.
The supported pool is partitioned into `never_issued`, `eligible_for_reuse`,
`reserved`, `cooling_down`, and `needs_review`. Missing closure times, invalid
prior invoices, and inconsistent allocation history require review. Past-expiry
pending invoices keep their addresses reserved until their status updates.
Estimated cooldown completion does not guarantee creation; wallet availability,
pending invoices, and merchant quotas still apply.

The additive `snapshot_status` table retains only each merchant's latest reuse
snapshot attempt and last-success timestamp. New merchants have no recorded
attempt. Diagnostics commit independently of the invoice transaction, so a failed
creation cannot erase them. A diagnostic storage failure is logged without
changing the creation result. Operator JSON logs correlate `snapshot_succeeded`,
`snapshot_failed`, and `allocation_rejected` with merchant-visible reference IDs.
They contain stable reason codes and numeric RPC codes, never raw RPC messages,
credentials, or key material. `diagnostic_storage_unavailable` means the latest
stored status may be incomplete; use the correlated operator logs.

Allocation failures preserve HTTP status and string `detail`, and add `code`,
`diagnostic_id`, and optional `retry_after_seconds`. Codes are `pool_exhausted`,
`allocation_contention`, and `snapshot_failed`; existing `Retry-After` headers
remain. Public donation errors stay generic and may include a reference ID.
Merchant diagnostics are excluded from public system health. The dashboard uses
manual refresh and refreshes availability after invoice creation attempts; it
adds no background monitoring or notification service.

For this additive reporting update, build API/reconciler and UI images, replace
the API first and wait for schema initialization, then replace reconciler and UI.
Reload Nginx after replacement, verify authenticated availability and public
health, and check a fresh successful reconciliation cycle. Validate creation
scenarios only with isolated fixtures, never real merchant wallets.

Late-payment classification uses the on-chain time when cumulative positive
transfers first reach the invoice amount. `detected_at` remains the time the
checkout observed the payment; `paid_after_expiry_at` records the on-chain
threshold-crossing time for payments that arrived after expiry. If transfer
timing is unavailable, detection time is used conservatively.

After upgrading an existing installation, review and repair stored late-payment
metadata with the reconciler's idempotent maintenance command. Run it without
`--apply` first to inspect the proposed changes:

```
docker compose exec -T reconciler python -m app.reclassify_invoice_timing
docker compose exec -T reconciler python -m app.reclassify_invoice_timing --apply
```

Outgoing webhooks can optionally use an authenticated Cloudflare Worker relay to
keep the server IP private from recipients. This defaults to off; see the
[webhook relay deployment guide](workers/webhook-relay/README.md).

Webhook destinations must use HTTPS and resolve exclusively to public IP
addresses. Loopback, private, link-local, and other special-use destinations
are rejected, including at redirect hops. This restriction applies to both the
native API and the BTCPay-compatible API.

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
  - The bundled shards and reconciler start by default with the stack.
  - Each container uses its own deterministic wallet shard under
    `./wallets/reconciler-1`, `./wallets/reconciler-2`, or
    `./wallets/reconciler-3`. Keep the URL ordering stable because it defines
    which shard owns each view-only wallet.
- Or point to an external wallet-rpc service:
  - Set `MONERO_WALLET_RPC_URLS`, `MONERO_WALLET_RPC_USER`, `MONERO_WALLET_RPC_PASSWORD`, and `MONERO_WALLET_RPC_WALLET_PASSWORD`
  - The reconciler uses the configured external URLs. The bundled shards may
    remain running but are not selected for invoice detection.

5. Start the stack:

```
docker compose up --build -d
```

This command starts the API, UI, reconciler, and bundled wallet-rpc shards.

If you’re running the bundled `monerod` service:

```
docker compose --profile local-daemon up --build -d
```

The `local-daemon` profile adds `monerod`; payment detection services remain
part of the default stack.

### Troubleshooting first payment detection

If an invoice stays at `0` confirmations or never moves out of `Awaiting funds`, check these in order:

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

To migrate an older shared `./wallets/reconciler` directory, stop the
reconciler and wallet-rpc services, validate the migration, then apply it:

```
python scripts/migrate_wallet_shards.py \
  --source wallets/reconciler --target-root wallets --shards 3
python scripts/migrate_wallet_shards.py \
  --source wallets/reconciler --target-root wallets --shards 3 --apply
```

The migration copies and verifies files; it does not alter the shared source
directory.

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
export NEXT_PUBLIC_DONATIONS_ENABLED="${DONATIONS_ENABLED:-false}"

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

## Translating the UI

The UI picks its language from the visitor's choice in the footer language
menu (stored in the `xmrcheckout_locale` cookie), else the browser's
`Accept-Language` header, else English. Supported: English, Spanish, Russian and German.

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
cd api
uvicorn app.main:app --reload
```

The API listens on `http://127.0.0.1:8000`.


### Reusable payment links

Follow the [payment button setup guide](https://xmrcheckout.com/guides/monero-payment-buttons) for the merchant walkthrough, embedding instructions, and limitations.

In Dashboard → Payment links, configure a fixed XMR amount or a fiat-reference
amount (for example 20 EUR). Preview the branded graphic and copy its linked-image
HTML into your website, or use the reusable URL with your own button.
By default the URL opens a review page. The per-link setting
“Skip review and create invoice automatically” (`auto_create_invoice`, default false)
lets an active, visible browser create an invoice and open checkout directly.
GET/HEAD remain read-only; automatic creation uses POST. Visits by automated
browsers can consume public allowance and address capacity too.
In automatic mode the same tab resumes its current unpaid invoice. Use
“Start another purchase” to deliberately create a separate order. Completed,
expired, or invalid previous invoices show a choice to view them or start again.
Without JavaScript or browser storage, customers use the manual review button.
No API key or wallet credential belongs in the snippet.

Fiat-reference inputs produce XMR invoices using an informational quote at
creation time, with source and timestamp. No exchange rate or fiat outcome is
guaranteed. A quote outage prevents creation. Editing settings affects future
invoices only. Disabling a link prevents new purchases; existing invoices remain
valid and continue detection. Full-settings PATCH requests use the same fields as creation; enabled-state-only
PATCH requests can disable a link without changing its product settings.

Public creations share the merchant's existing invoice and address limits and
`PUBLIC_PAYMENT_LINK_DAILY_LIMIT` (default 10 successful creations per rolling
24 hours, across all links). The public POST endpoint is additionally limited at
Nginx to 6 requests per minute per client IP, burst 3. A malicious visitor can
consume the public allowance. Existing address reuse and three-day cooldown
still apply; a fresh invoice does not guarantee a never-used address. Raising
the daily allowance does not expand the address pool.

Plain HTML provides no duplicate-submission recovery: each separate submission
can create another invoice. Do not automatically retry an interrupted request;
creation may have succeeded. Keep the invoice URL or contact the merchant before
submitting again. Customer details and protected digital delivery are outside
this feature. Merchants arrange fulfillment using the invoice ID; a return URL
does not protect a download.

Management API: authenticated GET/POST `/api/core/payment-links` and PATCH
`/api/core/payment-links/{id}`. Public GET
`/api/core/public/payment-links/{token}` exposes product details; public POST
`/api/core/public/payment-links/{token}/invoices` accepts an empty HTML form and
returns a 303 redirect, or an HTML error with applicable Retry-After information.
Clients may supply a UUID `Idempotency-Key` header and `Accept: application/json`.
Creation returns 201; replay returns 200 with the original `invoice_url`, current
`status`, and `expires_at`, without consuming additional allowance or addresses.
Save the attempt key before sending the request and retain it after errors;
explicit retries must reuse it. Keys are scoped to a payment link and must not
be placed in reusable URLs. JSON errors preserve Retry-After guidance.
Price, receiving wallet, confirmation, and URL overrides are rejected. Generated
invoices appear in the normal invoice list and webhook events, with a snapshot
in `metadata.payment_link`; search invoice metadata for the product or link ID.

Deploy the additive API schema before the UI. Rebuild API/UI/Nginx and restart;
verify read-only page and health responses. Observe public creation counts,
HTTP 429 responses, quote failures, and allocation diagnostics in service logs.
For rollback, disable links, restore preceding application images/configuration,
and retain additive tables and invoice records.

### In-person terminals

Follow the [in-person checkout guide](https://xmrcheckout.com/guides/in-person-monero-checkout) for the merchant walkthrough.

In Dashboard → Terminals, create a terminal and open its link (`/terminal#k=…`)
on the device at the till. The terminal key travels in the URL fragment, is
stored only as a hash, and is shown once; "Create new link" replaces it. A
terminal key can create invoices, read the status of its own invoices, and
cancel its own unpaid invoices (by expiring them now). It cannot read other
invoices, change settings, or use the merchant API. Resetting the merchant API
key does not change terminal links; disable or replace them separately.

Terminal invoices use the terminal's confirmation target (default 0) and expiry
(default 15 minutes), are tagged with `terminal_id` and `metadata.terminal`, and
appear in the normal invoice list, CSV export, and webhook events. Merchant
invoice limits and address capacity apply; the public payment-link allowance
does not. Between full reconciliation cycles the reconciler refreshes the wallet
and checks open terminal invoices every `TERMINAL_RECONCILE_INTERVAL_SECONDS`
(default 5), so unconfirmed payments are reported within seconds. Each refresh
is a wallet-rpc call per merchant with an open terminal sale; raise the interval
if wallet-rpc load matters more than speed.

Management API: authenticated GET/POST `/api/core/terminals`, PATCH
`/api/core/terminals/{id}`, and POST `/api/core/terminals/{id}/rotate`.
Terminal API (`Authorization: Terminal <key>`): GET `/api/core/terminal/status`,
POST `/api/core/terminal/invoices` (amount, currency, optional note, optional
UUID `Idempotency-Key`), GET `/api/core/terminal/invoices/{id}`, and POST
`/api/core/terminal/invoices/{id}/cancel`.

Payment-link verification uses isolated fixtures. Run the Python suite against a
throwaway PostgreSQL database named `payment_link_tests` to enable its HTTP and
concurrency tests; set `SUBADDRESS_DATABASE_TESTS=1` for allocation integration
coverage. Mount the repository's `scripts/` and `docker/` paths when testing in
the API image. Never point these tests at a merchant database.

Payment-link reliability checks build and use the UI/API/Nginx images. Run:

```sh
CHROMIUM_PATH=/path/to/chrome python3 tests/check_payment_links.py --playwright-module /path/to/playwright
```

This starts PostgreSQL, the real API, the UI, and Nginx on an isolated internal
Docker network, then serves the merchant button from a different loopback
origin. Wallet allocation, QR generation, quotes, and webhooks use fixtures.
The test verifies the cross-origin POST and 303 redirect with JavaScript disabled,
field errors and preserved input, allowance/address failures, and no invoice-list
fetch on the Payment links tab. Temporary containers and networks are removed.

Authenticated GET `/api/core/payment-links/status` returns the curated currency
choices and current rolling allowance (`daily_limit`, `used`, `remaining`,
`window_hours`, `retrieved_at`). The dashboard shows these alongside the existing
address status; refresh retrieves both without reserving capacity. Failed status
requests are shown as unavailable, not zero capacity.

Payment-link saves validate currencies against this curated server list without
contacting the quote provider. Existing unsupported settings remain visible for
correction. PATCH also accepts only `{"enabled": false}` to disable such a link;
`{"enabled": true}` validates all saved settings before enabling. Full-settings
PATCH requests remain compatible. The purchase operation runs in a worker
thread with its own database session, preserving atomic merchant/template locks.
