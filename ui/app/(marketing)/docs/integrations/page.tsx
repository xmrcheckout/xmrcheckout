import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Integration Recipes",
};

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:3000";
const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");
const publicApiBaseUrl = `${normalizedSiteUrl}/api/core`;

const codeBlockClass =
  "overflow-x-auto rounded-2xl border border-stroke bg-ink px-6 py-5 text-xs leading-relaxed text-cream shadow-soft";

const sectionCardClass =
  "rounded-2xl border border-stroke bg-white/70 p-7 shadow-soft backdrop-blur";

export default function IntegrationsPage() {
  return (
    <main className="px-[6vw] pb-20 pt-10 text-ink">
      <section className="grid max-w-[54rem] gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
          Integration recipes
        </p>
        <h1 className="font-serif text-[clamp(2.2rem,2rem+1.4vw,3.4rem)] leading-[1.1]">
          Copy/paste examples for common backends.
        </h1>
        <p className="text-[1.05rem] leading-relaxed text-ink-soft">
          Recipes follow the same pattern: create an invoice with an XMR amount, send
          the customer to the hosted invoice page, then fulfill your order when the
          invoice is confirmed.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            className="inline-flex items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:-translate-y-0.5"
            href="/docs"
          >
            Back to API docs
          </Link>
        </div>
        <nav
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-stroke bg-white/60 px-5 py-4 text-sm text-ink-soft shadow-soft backdrop-blur"
          aria-label="Recipe languages"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
            Jump to:
          </span>
          {[
            { href: "#btcpay", label: "BTCPay" },
            { href: "#curl", label: "curl" },
            { href: "#node", label: "Node.js" },
            { href: "#php", label: "PHP" },
            { href: "#python", label: "Python" },
            { href: "#go", label: "Go" },
          ].map((item) => (
            <a
              key={item.href}
              className="inline-flex items-center justify-center rounded-full border border-stroke bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:-translate-y-0.5"
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className={sectionCardClass}>
          <h2 className="font-serif text-2xl">Conceptual flow</h2>
	          <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-soft">
	            <li>
	              Create an invoice via{" "}
	              <span className="font-mono text-ink">POST /api/core/invoices</span>.
	            </li>
              <li>
                Optional: include{" "}
                <span className="font-mono text-ink">checkout_continue_url</span> to show a
                customer-facing Continue button after confirmation.
              </li>
	            <li>
	              Redirect the customer to <span className="font-mono text-ink">invoice_url</span>.
	            </li>
	            <li>
	              Wait for <span className="font-mono text-ink">invoice.confirmed</span> via webhook
	              (recommended) or polling.
	            </li>
	          </ol>
          <div className="mt-4 rounded-xl border border-stroke bg-white/60 p-4 text-sm text-ink-soft">
            <p className="font-semibold text-ink">What to store</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Your internal order id in{" "}
                <span className="font-mono text-ink">metadata.order_id</span>
              </li>
              <li>
                The returned <span className="font-mono text-ink">invoice.id</span>
              </li>
            </ul>
          </div>
        </div>

        <div className={sectionCardClass}>
          <h2 className="font-serif text-2xl">Environment variables</h2>
          <p className="mt-2 text-ink-soft">
            Keep secrets server-side. Never expose API keys or webhook secrets in browser
            code.
          </p>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="rounded-xl border border-stroke bg-white/60 p-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
                XMRCHECKOUT_API_KEY
              </p>
              <p className="mt-2 text-ink-soft">Used to call authenticated endpoints.</p>
            </div>
            <div className="rounded-xl border border-stroke bg-white/60 p-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
                XMRCHECKOUT_WEBHOOK_SECRET
              </p>
              <p className="mt-2 text-ink-soft">
                Used to verify the <span className="font-mono text-ink">X-Webhook-Secret</span>{" "}
                header on webhook deliveries.
              </p>
            </div>
            <div className="rounded-xl border border-stroke bg-white/60 p-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
                XMRCHECKOUT_API_BASE_URL
              </p>
              <p className="mt-2 text-ink-soft">
                Public base URL, including <span className="font-mono text-ink">/api/core</span>:{" "}
                <span className="font-mono text-ink">{publicApiBaseUrl}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="btcpay" className="mt-10 grid gap-6 scroll-mt-24">
        <div className="grid max-w-[54rem] gap-2">
          <h2 className="font-serif text-2xl">BTCPay compatibility (WooCommerce)</h2>
          <p className="text-ink-soft">
            Use the official WooCommerce Greenfield plugin with the compatibility
            endpoints. Keys remain view-only, and invoices stay non-custodial.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={sectionCardClass}>
            <h3 className="font-serif text-xl">Setup steps</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-soft">
              <li>Sign in to XMR Checkout to get your API key.</li>
              <li>
                Store id: returned by the login response or via{" "}
                <span className="font-mono text-ink">GET /api/v1/stores</span>. The
                stores call returns a single store (one per primary address); use the{" "}
                <span className="font-mono text-ink">id</span> field.
              </li>
              <li>Install the official BTCPay WooCommerce plugin.</li>
              <li>
                In WooCommerce → BTCPay settings, set:
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    Server URL:{" "}
                    <span className="font-mono text-ink">{normalizedSiteUrl}</span>{" "}
                    (the plugin appends <span className="font-mono text-ink">/api/v1</span>).
                  </li>
                  <li>Store ID: the id returned from the stores call.</li>
                  <li>API key: your XMR Checkout API key.</li>
                  <li>Payment method: XMR-CHAIN (shows as XMR_CHAIN in WooCommerce).</li>
                  <li>Modal checkout is supported; the hosted invoice page is recommended for clarity.</li>
                </ul>
              </li>
            </ol>
          </div>
	          <div className={sectionCardClass}>
	            <h3 className="font-serif text-xl">Behavior notes</h3>
	            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
	              <li>Authorization header: Authorization: token &lt;api_key&gt;.</li>
	              <li>
	                Status mapping: pending → New, payment detected → Processing, confirmed → final.
	              </li>
	              <li>Expired and Invalid statuses map directly.</li>
	              <li>Webhook deliveries use the BTCPay-Sig header.</li>
	            </ul>
	          </div>
	        </div>
        <pre className={codeBlockClass}>
          <code>{`# Verify compatibility endpoints
export XMRCHECKOUT_BTCPAY_URL="${normalizedSiteUrl}/api/v1"
export XMRCHECKOUT_API_KEY="xmrcheckout_..."

curl -sS "$XMRCHECKOUT_BTCPAY_URL/stores" \\
  -H "Authorization: token $XMRCHECKOUT_API_KEY"`}</code>
        </pre>
      </section>

      <section id="curl" className="mt-12 grid gap-8 scroll-mt-24">
        <div className="grid max-w-[52rem] gap-2">
          <h2 className="font-serif text-2xl">curl</h2>
          <p className="text-ink-soft">
            Create an invoice, then poll status until it is confirmed.
          </p>
        </div>

        <div className="grid gap-4">
          <pre className={codeBlockClass}>
            <code>{`# 1) Create invoice
export XMRCHECKOUT_API_BASE_URL="${publicApiBaseUrl}"
export XMRCHECKOUT_API_KEY="xmrcheckout_..."

curl -sS -X POST "$XMRCHECKOUT_API_BASE_URL/invoices" \\
  -H "Authorization: ApiKey $XMRCHECKOUT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount_xmr": "0.15",
    "confirmation_target": 2,
    "metadata": { "order_id": "ORDER-1234" }
  }'`}</code>
          </pre>

          <pre className={codeBlockClass}>
            <code>{`# 1b) Create invoice from fiat (non-binding conversion)
curl -sS -X POST "$XMRCHECKOUT_API_BASE_URL/invoices" \\
  -H "Authorization: ApiKey $XMRCHECKOUT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount_fiat": "100.00",
    "currency": "USD",
    "confirmation_target": 2,
    "metadata": { "order_id": "ORDER-1234" }
  }'`}</code>
          </pre>

          <pre className={codeBlockClass}>
            <code>{`# 2) Poll public status (no auth)
export INVOICE_ID="uuid-from-response"

curl -sS "$XMRCHECKOUT_API_BASE_URL/public/invoice/$INVOICE_ID"`}</code>
          </pre>
        </div>
      </section>

      <section id="node" className="mt-12 grid gap-8 scroll-mt-24">
        <div className="grid max-w-[52rem] gap-2">
          <h2 className="font-serif text-2xl">Node.js</h2>
          <p className="text-ink-soft">
            Example shows creating an invoice with <span className="font-mono text-ink">fetch</span>{" "}
            and receiving webhooks with Express.
          </p>
        </div>

        <div className="grid gap-4">
          <pre className={codeBlockClass}>
            <code>{`// create-invoice.mjs
const API_BASE_URL = process.env.XMRCHECKOUT_API_BASE_URL;
const API_KEY = process.env.XMRCHECKOUT_API_KEY;

export async function createInvoice({ amountXmr, orderId }) {
  const response = await fetch(\`\${API_BASE_URL}/invoices\`, {
    method: "POST",
    headers: {
      Authorization: \`ApiKey \${API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount_xmr: String(amountXmr),
      confirmation_target: 10,
      metadata: { order_id: orderId },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(\`xmrcheckout create invoice failed: \${response.status} \${text}\`);
  }

  return await response.json(); // includes invoice_url
}`}</code>
          </pre>

          <pre className={codeBlockClass}>
            <code>{`// webhook-server.mjs
import express from "express";

const WEBHOOK_SECRET = process.env.XMRCHECKOUT_WEBHOOK_SECRET;

const app = express();
app.use(express.json({ type: "application/json" }));

app.post("/xmrcheckout/webhook", (req, res) => {
  const headerSecret = req.get("x-webhook-secret") ?? "";
  if (!WEBHOOK_SECRET || headerSecret !== WEBHOOK_SECRET) {
    return res.sendStatus(401);
  }

  const event = req.body?.event;
  const invoice = req.body?.invoice;
  const orderId = invoice?.metadata?.order_id;

  if (event === "invoice.confirmed" && orderId) {
    // Mark your order paid here.
  }

  return res.sendStatus(204);
});

app.listen(3001, () => {
  console.log("Listening on http://localhost:3001/xmrcheckout/webhook");
});`}</code>
          </pre>
        </div>
      </section>

      <section id="php" className="mt-12 grid gap-8 scroll-mt-24">
        <div className="grid max-w-[52rem] gap-2">
          <h2 className="font-serif text-2xl">PHP</h2>
          <p className="text-ink-soft">
            Minimal create-invoice example and a webhook receiver endpoint.
          </p>
        </div>

        <div className="grid gap-4">
          <pre className={codeBlockClass}>
            <code>{`<?php
// create_invoice.php

$apiBaseUrl = getenv("XMRCHECKOUT_API_BASE_URL");
$apiKey = getenv("XMRCHECKOUT_API_KEY");

$payload = json_encode([
  "amount_xmr" => "0.15",
  "confirmation_target" => 10,
  "metadata" => ["order_id" => "ORDER-1234"],
]);

$ch = curl_init($apiBaseUrl . "/invoices");
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Authorization: ApiKey " . $apiKey,
  "Content-Type: application/json",
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($body === false || $status < 200 || $status >= 300) {
  http_response_code(500);
  echo "xmrcheckout error: HTTP " . $status;
  exit;
}

$invoice = json_decode($body, true);
echo $invoice["invoice_url"];`}</code>
          </pre>

          <pre className={codeBlockClass}>
            <code>{`<?php
// webhook.php

$webhookSecret = getenv("XMRCHECKOUT_WEBHOOK_SECRET");
$headerSecret = $_SERVER["HTTP_X_WEBHOOK_SECRET"] ?? "";
if (!$webhookSecret || $headerSecret !== $webhookSecret) {
  http_response_code(401);
  exit;
}

$raw = file_get_contents("php://input");
$payload = json_decode($raw, true);
$event = $payload["event"] ?? null;
$invoice = $payload["invoice"] ?? null;
$orderId = $invoice["metadata"]["order_id"] ?? null;

if ($event === "invoice.confirmed" && $orderId) {
  // Mark your order paid here.
}

http_response_code(204);`}</code>
          </pre>
        </div>
      </section>

      <section id="python" className="mt-12 grid gap-8 scroll-mt-24">
        <div className="grid max-w-[52rem] gap-2">
          <h2 className="font-serif text-2xl">Python</h2>
          <p className="text-ink-soft">
            Create an invoice with <span className="font-mono text-ink">requests</span> and
            receive webhooks with FastAPI.
          </p>
        </div>

        <div className="grid gap-4">
          <pre className={codeBlockClass}>
            <code>{`# create_invoice.py
import os
import requests

api_base_url = os.environ["XMRCHECKOUT_API_BASE_URL"].rstrip("/")
api_key = os.environ["XMRCHECKOUT_API_KEY"]

response = requests.post(
    f"{api_base_url}/invoices",
    headers={"Authorization": f"ApiKey {api_key}"},
    json={
        "amount_xmr": "0.15",
        "confirmation_target": 2,
        "metadata": {"order_id": "ORDER-1234"},
    },
    timeout=10,
)
response.raise_for_status()
invoice = response.json()
print(invoice["invoice_url"])`}</code>
          </pre>

          <pre className={codeBlockClass}>
            <code>{`# webhook_server.py
import os
from fastapi import FastAPI, Header, HTTPException

app = FastAPI()
webhook_secret = os.environ["XMRCHECKOUT_WEBHOOK_SECRET"]

@app.post("/xmrcheckout/webhook", status_code=204)
async def xmrcheckout_webhook(payload: dict, x_webhook_secret: str | None = Header(default=None)):
    if not x_webhook_secret or x_webhook_secret != webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    event = payload.get("event")
    invoice = payload.get("invoice") or {}
    metadata = invoice.get("metadata") or {}
    order_id = metadata.get("order_id")

    if event == "invoice.confirmed" and order_id:
        # Mark your order paid here.
        pass

    return None`}</code>
          </pre>
        </div>
      </section>

      <section id="go" className="mt-12 grid gap-8 scroll-mt-24">
        <div className="grid max-w-[52rem] gap-2">
          <h2 className="font-serif text-2xl">Go</h2>
          <p className="text-ink-soft">
            Create an invoice with <span className="font-mono text-ink">net/http</span> and
            receive webhooks with a standard handler.
          </p>
        </div>

        <div className="grid gap-4">
          <pre className={codeBlockClass}>
            <code>{`// create_invoice.go
package main

import (
  "bytes"
  "encoding/json"
  "fmt"
  "io"
  "net/http"
  "os"
  "strings"
  "time"
)

type invoiceResponse struct {
  ID         string ` + "`json:\"id\"`" + `
  InvoiceURL string ` + "`json:\"invoice_url\"`" + `
}

func main() {
  apiBaseURL := strings.TrimRight(os.Getenv("XMRCHECKOUT_API_BASE_URL"), "/")
  apiKey := os.Getenv("XMRCHECKOUT_API_KEY")

  payload := map[string]any{
    "amount_xmr":          "0.15",
    "confirmation_target": 2,
    "metadata": map[string]any{
      "order_id": "ORDER-1234",
    },
  }

  body, _ := json.Marshal(payload)
  req, _ := http.NewRequest("POST", apiBaseURL+"/invoices", bytes.NewReader(body))
  req.Header.Set("Authorization", "ApiKey "+apiKey)
  req.Header.Set("Content-Type", "application/json")

  client := &http.Client{Timeout: 10 * time.Second}
  resp, err := client.Do(req)
  if err != nil {
    panic(err)
  }
  defer resp.Body.Close()
  if resp.StatusCode < 200 || resp.StatusCode >= 300 {
    data, _ := io.ReadAll(resp.Body)
    panic(fmt.Sprintf("xmrcheckout create invoice failed: %d %s", resp.StatusCode, string(data)))
  }

  var invoice invoiceResponse
  if err := json.NewDecoder(resp.Body).Decode(&invoice); err != nil {
    panic(err)
  }
  fmt.Println(invoice.InvoiceURL)
}`}</code>
          </pre>

          <pre className={codeBlockClass}>
            <code>{`// webhook_server.go
package main

import (
  "encoding/json"
  "net/http"
  "os"
)

type webhookPayload struct {
  Event   string ` + "`json:\"event\"`" + `
  Invoice struct {
    Metadata map[string]any ` + "`json:\"metadata\"`" + `
  } ` + "`json:\"invoice\"`" + `
}

func main() {
  webhookSecret := os.Getenv("XMRCHECKOUT_WEBHOOK_SECRET")

  http.HandleFunc("/xmrcheckout/webhook", func(w http.ResponseWriter, r *http.Request) {
    headerSecret := r.Header.Get("X-Webhook-Secret")
    if webhookSecret == "" || headerSecret != webhookSecret {
      w.WriteHeader(http.StatusUnauthorized)
      return
    }

    var payload webhookPayload
    if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
      w.WriteHeader(http.StatusBadRequest)
      return
    }

    if payload.Event == "invoice.confirmed" {
      if orderID, ok := payload.Invoice.Metadata["order_id"].(string); ok && orderID != "" {
        // Mark your order paid here.
        _ = orderID
      }
    }

    w.WriteHeader(http.StatusNoContent)
  })

  _ = http.ListenAndServe(":3001", nil)
}`}</code>
          </pre>
        </div>
      </section>
    </main>
  );
}
