# UI request protection

The UI validates multipart POST boundaries in `ui/proxy.ts`, before Next.js
parses Server Actions. Missing, empty, non-ASCII, and invalid boundaries return
400. Valid browser and quoted boundaries pass through. The guard does not read
or log request bodies. An invalid body with a valid boundary can still produce
a framework error; genuine 500 responses are not rewritten.

In `conf.d/default.conf`, UI POSTs share a per-client limit of 5 requests per
second with a burst of 10 and immediate HTTP 429 rejection after the burst.
Adjust `ui_post_rate_limit` and its `burst` together for your deployment.
GET/HEAD requests and `/api/` requests do not consume this POST bucket.
Public payment-link POSTs under `/api/core/public/payment-links/` have a separate
6 requests/minute per-client bucket with burst 3, and an HTML 429 response with
`Retry-After: 60`. Read-only product requests do not consume that bucket. The
existing global 50 requests/second, burst 200 limit still applies.
Payment proof POSTs under `/api/core/invoices/{id}/payment-proof` have their own
6 requests/minute per-client bucket with burst 3 and a 16 KB body limit, because
each check can hold a wallet RPC lock. Dashboard checks reach the API directly,
so the API also limits each merchant to 10 checks a minute per worker.

Only the `cloudflared` service may supply `CF-Connecting-IP`. Other peers use
their connection address, regardless of incoming client-IP headers. Nginx
resolves the trusted service at startup/reload: reload Nginx after recreating
the tunnel if its IP changes. For deployments without this tunnel, remove the
two real-IP directives or configure the exact trusted ingress peer instead.
Do not trust an entire Docker subnet or publish a tunnel-only origin directly.

## Verification

With the UI and Nginx images built, run:

```sh
cd ui
npm test
npm run lint
cd ..
python3 tests/check_ui_request_protection.py
```

Pass `--playwright-module /path/to/installed/playwright` to include browser
login and invoice failure/success tests. Set `CHROMIUM_PATH` if the browser
executable is outside Playwright's default cache. All integration requests use
an isolated internal Docker network and a fake API; no production credentials,
wallet RPC, or invoice records are involved. Test logs are saved privately in
the printed temporary directory.

Before deploying, archive the current UI/proxy logs and record the current
image IDs. Run `docker compose build ui nginx` and `docker compose up -d`, then
check Nginx configuration and ordinary page responses. To roll back, restore
the preceding proxy configuration and UI image, run `nginx -t`, and recreate
the affected services. Alternatively, revert the cohesive change and rebuild:

```sh
git revert <request-protection-commit>
docker compose build ui nginx
docker compose up -d
docker compose exec -T nginx nginx -t
```

This change does not add durable log collection.
