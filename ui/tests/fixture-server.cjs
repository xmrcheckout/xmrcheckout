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

const server = http.createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    const path = new URL(request.url, "http://fixture").pathname;
    let status = 200;
    let result = {};
    if (path === "/api/core/auth/validate") {
      status = 204;
    } else if (path === "/api/core/auth/login") {
      result = { api_key: "fixture-only-api-key", webhook_secret: "fixture-only-webhook-secret" };
    } else if (path === "/api/core/profile") {
      result = profile;
    } else if (path === "/api/core/invoices" && request.method === "GET") {
      result = { items: [], total: 0 };
    } else if (path === "/api/core/invoices" && request.method === "POST") {
      if (JSON.parse(body).amount_xmr === "0.2") {
        status = 201;
        result = { id: "fixture-invoice-created", address, subaddress_index: 1, amount_xmr: "0.2", warnings: [] };
      } else {
        status = 503;
        result = { detail: "Fixture invoice service unavailable" };
      }
    } else if (path.includes("webhooks")) {
      result = [];
    } else if (path === "/api/core/public/system/status") {
      result = { wallet_rpc: "ok", daemon: "ok", reconciler: "ok", daemon_height: 3788216, invoice_reconcile_interval_seconds: 30 };
    } else {
      status = 404;
      result = { detail: "Unknown fixture route" };
    }
    // Deliberately log only method/path/status, never fields or credentials.
    console.log("fixture", request.method, path, status);
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(status === 204 ? undefined : JSON.stringify(result));
  });
});

server.listen(8000, "0.0.0.0", () => {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"], { stdio: "inherit" });
  child.on("exit", (code) => server.close(() => process.exit(code ?? 1)));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
});
