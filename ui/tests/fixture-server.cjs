const http = require("node:http");
const { spawn } = require("node:child_process");

const address = "4" + "1".repeat(94);
const profile = {
  id: "00000000-0000-0000-0000-000000000001",
  payment_address: address,
  default_confirmation_target: 2,
  default_qr_logo: "monero",
  default_qr_logo_data_url: null,
  created_at: "2026-10-01T00:00:00Z",
};
let availabilityState = "ready";
let invoiceStatus = "pending";
let invoiceResponseStatus = 200;
let invoiceExpiry;
let confirmationTarget = 2;
let confirmations = null;
let checkingDelayed = false;
const defaultInvoiceQuote = { fiat_amount: "20", fiat_currency: "EUR", rate: "200", source: "fixture", quoted_at: "2026-10-30T12:00:00Z" };
let invoiceQuote = defaultInvoiceQuote;
let amountPaid = null;
let amountRemaining = null;
let invoiceTransportFailure = false;
let checkoutStyle = "standard";
let layoutFixture = false;
let availabilityDelay = 0;
let webhookDeliveries = [];
let healthCompletedAt = null;
let paymentLink = { id: "00000000-0000-4000-8000-000000000777", title: "Fixture product", button_text: "Buy with Monero", description: "Manual delivery", amount_xmr: "0.1", amount_fiat: null, currency: null, confirmation_target: 2, checkout_continue_url: null, confirmation_message: null, enabled: true,
  url: `${process.env.FIXTURE_UI_URL || "http://127.0.0.1:3300"}/pay/fixture-token`,
  action_url: `http://127.0.0.1:${process.env.FIXTURE_API_PORT || 8000}/api/core/public/payment-links/fixture-token/invoices` };

const reference = "00000000-0000-4000-8000-000000000123";
const fixtureInvoice = "00000000-0000-4000-8000-000000000456";
let transferMode = "populated";
let transferDelay = 0;

function availability() {
  const exhausted = availabilityState === "exhausted";
  const rows = [
    { index: 1, category: exhausted ? "reserved" : "never_issued", code: exhausted ? "active_invoice" : "never_issued" },
    { index: 2, category: exhausted ? "reserved" : "eligible_for_reuse", code: exhausted ? "active_invoice" : "cooldown_complete" },
    { index: 3, category: "reserved", code: "awaiting_invoice_status_update" },
    { index: 4, category: "cooling_down", code: "reuse_cooldown" },
    { index: 5, category: "needs_review", code: "missing_closure_time" },
  ].map((row) => ({ ...row, invoice_ids: row.index === 3 ? [fixtureInvoice] : [],
    latest_closure_at: row.index === 2 || row.index === 4 ? "2026-10-29T12:00:00Z" : null,
    cooldown_complete_at: row.index === 4 ? "2026-11-05T12:00:00Z" : null }));
  const counts = Object.fromEntries(["never_issued", "eligible_for_reuse", "reserved", "cooling_down", "needs_review"]
    .map((category) => [category, rows.filter((row) => row.category === category).length]));
  return { retrieved_at: new Date().toISOString(), cooldown_seconds: 604800, pool_size: 5, counts,
    earliest_estimated_eligibility_at: "2026-11-05T12:00:00Z", addresses: rows,
    snapshot: ["snapshot_failed", "recovered"].includes(availabilityState) ? {
      attempt_id: reference, attempted_at: "2026-10-30T12:00:00Z", completed_at: "2026-10-30T12:00:01Z",
      outcome: availabilityState === "recovered" ? "succeeded" : "failed", duration_ms: 1000,
      failure_category: availabilityState === "recovered" ? null : "wallet_syncing",
      last_success_at: "2026-10-29T12:00:00Z",
    } : null };
}

const server = http.createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    const path = new URL(request.url, "http://fixture").pathname;
    let status = 200;
    let result = {};
    if (path === "/__fixture" && request.method === "POST") {
      const options = JSON.parse(body);
      availabilityState = options.state ?? availabilityState;
      invoiceStatus = options.invoiceStatus ?? invoiceStatus;
      invoiceResponseStatus = options.invoiceResponseStatus ?? invoiceResponseStatus;
      if (Object.hasOwn(options, "invoiceExpiry")) invoiceExpiry = options.invoiceExpiry === "soon" ? new Date(Date.now() + 2500).toISOString() : options.invoiceExpiry;
      confirmationTarget = options.confirmationTarget ?? confirmationTarget;
      if (Object.hasOwn(options, "confirmations")) confirmations = options.confirmations;
      checkingDelayed = options.checkingDelayed ?? checkingDelayed;
      if (Object.hasOwn(options, "invoiceQuote")) invoiceQuote = options.invoiceQuote === "default" ? defaultInvoiceQuote : options.invoiceQuote;
      if (Object.hasOwn(options, "amountPaid")) amountPaid = options.amountPaid;
      if (Object.hasOwn(options, "amountRemaining")) amountRemaining = options.amountRemaining;
      invoiceTransportFailure = options.invoiceTransportFailure ?? invoiceTransportFailure;
      checkoutStyle = options.checkoutStyle ?? checkoutStyle;
      layoutFixture = options.layoutFixture ?? layoutFixture;
      if (Object.hasOwn(options, "profileStyle")) {
        if (options.profileStyle === null) delete profile.btcpay_checkout_style;
        else profile.btcpay_checkout_style = options.profileStyle;
      }
      webhookDeliveries = options.webhookDeliveries ?? webhookDeliveries;
      if (Object.hasOwn(options, "healthCompletedAt")) healthCompletedAt = options.healthCompletedAt;
      availabilityDelay = options.delay ?? 0;
      transferMode = options.transferMode ?? transferMode;
      transferDelay = options.transferDelay ?? 0;
    } else if (path === "/api/core/payment-links/status") {
      result = { supported_currencies: ["USD", "EUR", "GBP"], daily_limit: 10, used: 0, remaining: 10, window_hours: 24, retrieved_at: new Date().toISOString() };
    } else if (path === "/api/core/payment-links" && request.method === "GET") {
      result = [paymentLink];
    } else if (path.startsWith("/api/core/payment-links") && ["POST", "PATCH"].includes(request.method)) {
      paymentLink = { ...paymentLink, ...JSON.parse(body) };
      result = paymentLink;
    } else if (path === "/api/core/public/payment-links/fixture-token") {
      status = paymentLink.enabled ? 200 : 404;
      result = paymentLink.enabled ? paymentLink : { detail: "Unavailable" };
    } else if (path === "/api/core/public/payment-links/fixture-token/invoices") {
      if (request.method === "POST") {
        response.writeHead(303, { Location: `${process.env.FIXTURE_UI_URL || "http://127.0.0.1:3300"}/invoice/${fixtureInvoice}` });
        response.end();
        return;
      }
      status = 405;
    } else if ([`/api/core/public/invoice/${fixtureInvoice}`, `/api/core/public/donation/${fixtureInvoice}`].includes(path)) {
      if (invoiceTransportFailure) {
        console.log("fixture", request.method, path, "disconnected");
        request.socket.destroy();
        return;
      }
      status = invoiceResponseStatus;
      result = { id: fixtureInvoice, address, amount_xmr: "0.1", amount_paid_xmr: amountPaid, amount_remaining_xmr: amountRemaining, status: invoiceStatus, confirmation_target: confirmationTarget, confirmations: confirmations ?? (invoiceStatus === "confirmed" ? confirmationTarget : invoiceStatus === "payment_detected" ? Math.max(0, confirmationTarget - 1) : 0), checking_delayed: checkingDelayed, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), product_title: "Fixture product", product_description: "Manual delivery", recipient_name: "Fixture shop", quote: invoiceQuote };
      if (invoiceExpiry !== undefined && invoiceExpiry !== "default") {
        result.expires_at = invoiceExpiry;
      }
      if (checkoutStyle === "btcpay_classic") Object.assign(result, { btcpay_amount: "0.1", btcpay_currency: "XMR", btcpay_checkout_style: checkoutStyle });
    } else if (path.startsWith("/api/core/public/invoice/")) {
      status = /^[0-9a-f-]{36}$/i.test(path.split("/").pop()) ? 404 : 422;
      result = { detail: "Fixture invoice unavailable" };
    } else if (path === "/api/core/subaddresses/status") {
      status = availabilityState === "unavailable" ? 503 : 200;
      result = status === 200 ? availability() : { detail: "Fixture unavailable" };
    } else if (path === "/api/core/auth/validate") {
      status = 204;
    } else if (path === "/api/core/auth/login") {
      result = { api_key: "fixture-only-api-key", webhook_secret: "fixture-only-webhook-secret" };
    } else if (path === "/api/core/profile") {
      if (request.method === "PATCH") Object.assign(profile, JSON.parse(body));
      result = profile;
    } else if (path === "/api/core/invoices" && request.method === "GET") {
      result = { items: [
        { metadata: { description: "Fixture order description" } },
        { metadata: { payment_link: { title: "Fixture product title" }, order_id: "123" } },
        { metadata: { description: { malformed: true }, posData: "{" } },
        { metadata: { description: "Long description ".repeat(20) } },
        ...(layoutFixture ? [{ metadata: { description: "Invalid fixture invoice" } }] : []),
      ].map((item, index) => ({ id: `00000000-0000-4000-8000-00000000000${index}`, address, amount_xmr: layoutFixture ? "123.037683234728" : "0.1", status: layoutFixture ? ["pending", "payment_detected", "confirmed", "expired", "invalid"][index] : "pending", confirmation_target: 2, confirmations: 0, created_at: "2026-10-01T00:00:00Z", expires_at: null, archived_at: null, detected_at: null, confirmed_at: null, ...item })), total: layoutFixture ? 5 : 4 };
    } else if (path === "/api/core/invoices" && request.method === "POST") {
      if (JSON.parse(body).amount_xmr === "0.2") {
        availabilityState = "recovered";
        status = 201;
        result = { id: "fixture-invoice-created", address, subaddress_index: 1, amount_xmr: "0.2", warnings: [] };
      } else if (["0.3", "0.4", "0.5"].includes(JSON.parse(body).amount_xmr)) {
        const amount = JSON.parse(body).amount_xmr;
        status = amount === "0.3" ? 429 : 503;
        result = { detail: "Fixture allocation rejected", code: amount === "0.3" ? "pool_exhausted" : amount === "0.4" ? "allocation_contention" : "snapshot_failed", diagnostic_id: reference, ...(amount === "0.5" ? {} : { retry_after_seconds: 5 }) };
        availabilityState = amount === "0.3" ? "exhausted" : "snapshot_failed";
      } else {
        status = 503;
        result = { detail: "Fixture invoice service unavailable" };
      }
    } else if (/^\/api\/core\/invoices\/[^/]+\/transfers$/.test(path)) {
      status = transferMode === "error" ? 503 : 200;
      result = transferMode === "error" ? { detail: "Unavailable" } : transferMode === "empty" ? [] : [{ txid: (path.includes("000000000001/") ? "b" : "a").repeat(64), amount_xmr: "0.1", confirmations: 3, timestamp: 1790000000 }];
    } else if (path === "/api/core/webhooks/history") {
      result = webhookDeliveries;
    } else if (path.includes("webhooks")) {
      result = [];
    } else if (path === "/api/core/system/status") {
      result = { wallet_rpc: "ok", daemon: "ok", reconciler: "ok", daemon_height: 3788216, invoice_reconcile_interval_seconds: 30,
        last_reconcile_started_at: healthCompletedAt, last_reconcile_completed_at: healthCompletedAt, last_reconcile_error: null,
        last_reconcile_attempted_invoices: 4, last_reconcile_succeeded_invoices: 4, last_reconcile_failed_invoices: 0 };
    } else if (path.startsWith("/api/core/public/rates/")) {
      result = { rate: "200", quoted_at: "2026-10-31T12:00:00Z", source: "fixture" };
    } else if (path === "/api/core/public/system/status") {
      result = { wallet_rpc: "ok", daemon: "ok", reconciler: "ok", daemon_height: 3788216, invoice_reconcile_interval_seconds: 30 };
    } else {
      status = 404;
      result = { detail: "Unknown fixture route" };
    }
    // Deliberately log only method/path/status, never fields or credentials.
    console.log("fixture", request.method, path, status);
    const send = () => {
      response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(status === 204 ? undefined : JSON.stringify(result));
    };
    if (path === "/api/core/subaddresses/status" && availabilityDelay) setTimeout(send, availabilityDelay);
    else if (path.endsWith("/transfers") && transferDelay) setTimeout(send, transferDelay);
    else send();
  });
});

// Optional same-origin proxy for browser requests; the Next server uses API_BASE_URL.
if (process.env.FIXTURE_PROXY_PORT) {
  http.createServer((request, response) => {
    const upstream = http.request({ hostname: "127.0.0.1", port: request.url.startsWith("/api/") ? Number(process.env.FIXTURE_API_PORT ?? 8000) : Number(process.env.PORT ?? 3000), path: request.url, method: request.method, headers: request.headers }, result => {
      response.writeHead(result.statusCode, result.headers);
      result.pipe(response);
    });
    upstream.on("error", () => { response.writeHead(502); response.end("Fixture unavailable"); });
    request.pipe(upstream);
  }).listen(Number(process.env.FIXTURE_PROXY_PORT), "127.0.0.1");
}

server.listen(Number(process.env.FIXTURE_API_PORT ?? 8000), "0.0.0.0", () => {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"], { stdio: "inherit" });
  child.on("exit", (code) => server.close(() => process.exit(code ?? 1)));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
});
