import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import PageIntroBand from "../../../../components/page-intro-band";
import CopyCodeBlock from "../../../../components/copy-code-block";
import { rich } from "../../../../lib/i18n/rich";
import { getI18n } from "../../../../lib/i18n/server";
import type { Translate } from "../../../../lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("docs.integrations.metaTitleShort"),
    description: t("docs.integrations.metaDescription"),
    alternates: { canonical: "/docs/integrations" },
    openGraph: {
      type: "website",
      url: "/docs/integrations",
      siteName: "XMR Checkout",
      title: t("docs.integrations.metaTitle"),
      description: t("docs.integrations.metaDescription"),
    },
  };
}

const mono = (text: string) => <span className="font-mono text-ink">{text}</span>;
const guideLink = "font-semibold underline decoration-clay underline-offset-4";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "http://localhost:3000";
const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");
const publicApiBaseUrl = `${normalizedSiteUrl}/api/core`;

const codeBlockClass =
  "min-w-0 max-w-full overflow-x-auto rounded-surface border border-ink bg-ink px-5 py-5 pr-24 text-xs leading-relaxed text-cream shadow-soft sm:px-6";

const sectionCardClass =
  "rounded-surface border border-stroke bg-card p-6 shadow-soft sm:p-7";

function RecipeHeader({
  children,
  id,
  index,
  title,
  t,
}: {
  children: ReactNode;
  id: string;
  index: string;
  title: string;
  t: Translate;
}) {
  return (
    <header className="max-w-[54rem]">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="h-2.5 w-2.5 rounded-full bg-clay" aria-hidden="true" />
        {t("docs.integrations.recipe", { index })}
      </p>
      <h2 className="mt-1 font-sans text-2xl font-semibold" id={`${id}-title`}>
        {title}
      </h2>
      <div className="mt-1 text-ink-soft">{children}</div>
    </header>
  );
}

export default async function IntegrationsPage() {
  const { t } = await getI18n();
  return (
    <main id="main-content" tabIndex={-1} className="reference-page px-[6vw] pb-20 pt-8 text-ink">
      <div className="mx-auto w-full max-w-7xl">
        <section aria-label={t("docs.integrations.introLabel")}>
          <PageIntroBand
            eyebrow={t("docs.recipes")}
            id="integration-recipes-title"
            title={t("docs.integrations.title")}
            description={
              <p>
                {t("docs.integrations.intro")}
              </p>
            }
          />
        </section>

        <div className="mt-5">
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
            href="/docs"
          >
            {t("docs.integrations.backToDocs")}
          </Link>
        </div>

        <p className="mt-4 max-w-3xl text-sm text-ink-soft">
          {rich(t("docs.integrations.needWhole"), { guide: (text) => <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides/monero-payment-api-webhooks">{text}</Link> })}
        </p>

        <nav
          className="sticky top-3 z-10 mt-6 flex gap-1.5 overflow-x-auto rounded-surface border border-stroke bg-card/95 p-2 shadow-soft backdrop-blur"
          aria-label={t("docs.recipes")}
        >
          {[
            { href: "#payment-buttons", label: t("docs.integrations.navButtons") },
            { href: "#btcpay", label: "BTCPay" },
            { href: "#curl", label: "curl" },
            { href: "#node", label: "Node.js" },
            { href: "#php", label: "PHP" },
            { href: "#python", label: "Python" },
            { href: "#go", label: "Go" },
          ].map((item, index) => (
            <a
              key={item.href}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-ink-soft transition hover:border-stroke hover:bg-white/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
              href={item.href}
            >
              <span className="font-mono text-xs text-ink-soft">
                0{index + 1}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        <section id="payment-buttons" className="mt-8 min-w-0 scroll-mt-24 rounded-surface border border-stroke bg-card p-6 shadow-soft">
          <h2 className="font-sans text-2xl font-semibold">{t("docs.integrations.buttonsTitle")}</h2>
          <p className="mt-3">{t("docs.integrations.buttonsBody")}</p>
          <p className="mt-3">{rich(t("docs.integrations.buttonsGuide"), {
            guide: (text) => <Link className={guideLink} href="/guides/monero-payment-buttons">{text}</Link>,
            message: (text) => <Link className={guideLink} href="/guides/monero-payment-buttons#confirmation-message">{text}</Link>,
          })}</p>
        </section>
        <section className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-surface border border-stroke bg-card shadow-soft">
            <div className="px-5 py-5 sm:px-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-clay"
                  aria-hidden="true"
                />
                {t("docs.integrations.requestPath")}
              </p>
              <h2 className="mt-1 font-sans text-2xl font-semibold">
                {t("docs.integrations.flowTitle")}
              </h2>
            </div>
            <ol className="grid divide-y divide-stroke border-y border-stroke bg-white/60 sm:grid-cols-2 sm:divide-x">
              <li className="min-w-0 px-5 py-4 sm:px-6">
                <span className="font-mono text-xs text-ink-soft">01</span>
                <p className="mt-2 text-sm text-ink-soft">
                  {rich(t("docs.integrations.flow1"), { code: mono })}
                </p>
              </li>
              <li className="min-w-0 px-5 py-4 sm:px-6">
                <span className="font-mono text-xs text-ink-soft">02</span>
                <p className="mt-2 text-sm text-ink-soft">
                  {rich(t("docs.integrations.flow2"), { code: mono })}
                </p>
              </li>
              <li className="min-w-0 px-5 py-4 sm:px-6">
                <span className="font-mono text-xs text-ink-soft">03</span>
                <p className="mt-2 text-sm text-ink-soft">
                  {rich(t("docs.integrations.flow3"), { code: mono })}
                </p>
              </li>
              <li className="min-w-0 px-5 py-4 sm:px-6">
                <span className="font-mono text-xs text-ink-soft">04</span>
                <p className="mt-2 text-sm text-ink-soft">
                  {rich(t("docs.integrations.flow4"), { code: mono })}
                </p>
              </li>
            </ol>
            <div className="bg-sand/50 px-5 py-4 text-sm text-ink-soft sm:px-6">
              <p className="font-semibold text-ink">{t("docs.integrations.whatToStore")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  {rich(t("docs.integrations.store1"), { code: mono })}
                </li>
                <li>
                  {rich(t("docs.integrations.store2"), { code: mono })}
                </li>
              </ul>
              <p className="mt-3">
                {rich(t("docs.integrations.receiptNote"), { code: mono })}
              </p>
            </div>
          </div>

          <div className={`${sectionCardClass} border-t-4 border-t-clay`}>
            <h2 className="font-sans text-2xl font-semibold">
              {t("docs.integrations.envTitle")}
            </h2>
            <p className="mt-2 text-ink-soft">
              {t("docs.integrations.envBody")}
            </p>
            <dl className="mt-4 divide-y divide-stroke border-y border-stroke text-sm">
              <div className="py-4">
                <dt className="break-all font-mono text-xs font-semibold text-ink">
                  XMRCHECKOUT_API_KEY
                </dt>
                <dd className="mt-1 text-ink-soft">
                  {t("docs.integrations.envApiKey")}
                </dd>
              </div>
              <div className="py-4">
                <dt className="break-all font-mono text-xs font-semibold text-ink">
                  XMRCHECKOUT_WEBHOOK_SECRET
                </dt>
                <dd className="mt-1 text-ink-soft">
                  {rich(t("docs.integrations.envSecret"), { code: mono })}
                </dd>
              </div>
              <div className="py-4">
                <dt className="break-all font-mono text-xs font-semibold text-ink">
                  XMRCHECKOUT_API_BASE_URL
                </dt>
                <dd className="mt-1 break-words text-ink-soft">
                  {rich(t("docs.integrations.envBase"), { code: mono })}{" "}
                  <span className="break-all font-mono text-ink">
                    {publicApiBaseUrl}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section
          id="btcpay"
          className="mt-12 grid scroll-mt-24 gap-6 border-t border-stroke pt-8"
          aria-labelledby="btcpay-title"
        >
          <RecipeHeader t={t}
            id="btcpay"
            index="01"
            title={t("docs.btcpayTitle")}
          >
            <p className="text-ink-soft">
              {t("docs.integrations.btcpayIntro")}
            </p>
          </RecipeHeader>
          <details className="group grid gap-6 rounded-surface border border-stroke bg-card p-4 shadow-soft sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl border border-stroke bg-white/70 px-4 py-3 font-sans font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
              <span>{t("docs.integrations.viewSetup")}</span>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:hidden">
                {t("docs.integrations.expand")}
              </span>
              <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:inline">
                {t("docs.integrations.collapse")}
              </span>
            </summary>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className={sectionCardClass}>
              <h3 className="font-sans font-semibold text-xl">{t("docs.integrations.setupSteps")}</h3>
              <ol className="mt-3 list-decimal space-y-3 pl-5 text-ink-soft marker:font-mono marker:text-ink-soft">
                <li>{t("docs.integrations.btcpayConnect")}</li>
                <li>
                  {rich(t("docs.integrations.btcpayStoreId"), { code: mono })}
                </li>
                <li>{t("docs.integrations.btcpayInstall")}</li>
                <li>
                  {t("docs.integrations.btcpaySettings")}
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>
                      {t("docs.integrations.serverUrl")}{" "}
                      <span className="font-mono text-ink">
                        {normalizedSiteUrl}
                      </span>{" "}
                      {rich(t("docs.integrations.pluginAppends"), { code: mono })}
                    </li>
                    <li>{t("docs.integrations.btcpayStoreField")}</li>
                    <li>{t("docs.integrations.btcpayApiKey")}</li>
                    <li>
                      {t("docs.integrations.btcpayMethod")}
                    </li>
                    <li>
                      {t("docs.integrations.btcpayModal")}
                    </li>
                  </ul>
                </li>
              </ol>
            </div>
            <div className={`${sectionCardClass} border-t-4 border-t-sage`}>
              <h3 className="font-sans font-semibold text-xl">
                {t("docs.integrations.behaviorNotes")}
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
                <li>
                  {t("docs.integrations.authHeader")}
                </li>
                <li>
                  {t("docs.integrations.statusMapping")}
                </li>
                <li>{t("docs.integrations.expiredInvalid")}</li>
                <li>{t("docs.integrations.btcpaySig")}</li>
              </ul>
            </div>
          </div>
          <CopyCodeBlock className={codeBlockClass}>
            <code>{`# Verify compatibility endpoints
export XMRCHECKOUT_BTCPAY_URL="${normalizedSiteUrl}/api/v1"
export XMRCHECKOUT_API_KEY="xmrcheckout_..."

curl -sS "$XMRCHECKOUT_BTCPAY_URL/stores" \\
  -H "Authorization: token $XMRCHECKOUT_API_KEY"`}</code>
          </CopyCodeBlock>
          </details>
        </section>

        <section
          id="curl"
          className="mt-12 grid scroll-mt-24 gap-8 border-t border-stroke pt-8"
          aria-labelledby="curl-title"
        >
          <RecipeHeader t={t} id="curl" index="02" title="curl">
            <p className="text-ink-soft">
              {t("docs.integrations.curlIntro")}
            </p>
          </RecipeHeader>
          <details className="group grid gap-4 rounded-surface border border-stroke bg-card p-4 shadow-soft sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl border border-stroke bg-white/70 px-4 py-3 font-sans font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
              <span>{t("docs.integrations.viewCurl")}</span>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:hidden">
                {t("docs.integrations.expand")}
              </span>
              <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:inline">
                {t("docs.integrations.collapse")}
              </span>
            </summary>
          <div className="grid gap-4">
            <CopyCodeBlock className={codeBlockClass}>
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
            </CopyCodeBlock>

            <CopyCodeBlock className={codeBlockClass}>
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
            </CopyCodeBlock>

            <CopyCodeBlock className={codeBlockClass}>
              <code>{`# 2) Poll public status (no auth)
export INVOICE_ID="uuid-from-response"

curl -sS "$XMRCHECKOUT_API_BASE_URL/public/invoice/$INVOICE_ID"`}</code>
            </CopyCodeBlock>
          </div>
          </details>
        </section>

        <section
          id="node"
          className="mt-12 grid scroll-mt-24 gap-8 border-t border-stroke pt-8"
          aria-labelledby="node-title"
        >
          <RecipeHeader t={t} id="node" index="03" title="Node.js">
            <p className="text-ink-soft">
              {rich(t("docs.integrations.nodeIntro"), { code: mono })}
            </p>
          </RecipeHeader>
          <details className="group grid gap-4 rounded-surface border border-stroke bg-card p-4 shadow-soft sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl border border-stroke bg-white/70 px-4 py-3 font-sans font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
              <span>{t("docs.integrations.viewNode")}</span>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:hidden">
                {t("docs.integrations.expand")}
              </span>
              <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:inline">
                {t("docs.integrations.collapse")}
              </span>
            </summary>
          <div className="grid gap-4">
            <CopyCodeBlock className={codeBlockClass}>
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
            </CopyCodeBlock>

            <CopyCodeBlock className={codeBlockClass}>
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
    // Optionally send invoice.receipt_url to your customer from your own system.
  }

  return res.sendStatus(204);
});

app.listen(3001, () => {
  console.log("Listening on http://localhost:3001/xmrcheckout/webhook");
});`}</code>
            </CopyCodeBlock>
          </div>
          </details>
        </section>

        <section
          id="php"
          className="mt-12 grid scroll-mt-24 gap-8 border-t border-stroke pt-8"
          aria-labelledby="php-title"
        >
          <RecipeHeader t={t} id="php" index="04" title="PHP">
            <p className="text-ink-soft">
              {t("docs.integrations.phpIntro")}
            </p>
          </RecipeHeader>
          <details className="group grid gap-4 rounded-surface border border-stroke bg-card p-4 shadow-soft sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl border border-stroke bg-white/70 px-4 py-3 font-sans font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
              <span>{t("docs.integrations.viewPhp")}</span>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:hidden">
                {t("docs.integrations.expand")}
              </span>
              <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:inline">
                {t("docs.integrations.collapse")}
              </span>
            </summary>
          <div className="grid gap-4">
            <CopyCodeBlock className={codeBlockClass}>
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
            </CopyCodeBlock>

            <CopyCodeBlock className={codeBlockClass}>
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
  // Optionally send $invoice["receipt_url"] to your customer from your own system.
}

http_response_code(204);`}</code>
            </CopyCodeBlock>
          </div>
          </details>
        </section>

        <section
          id="python"
          className="mt-12 grid scroll-mt-24 gap-8 border-t border-stroke pt-8"
          aria-labelledby="python-title"
        >
          <RecipeHeader t={t} id="python" index="05" title="Python">
            <p className="text-ink-soft">
              {rich(t("docs.integrations.pythonIntro"), { code: mono })}
            </p>
          </RecipeHeader>
          <details className="group grid gap-4 rounded-surface border border-stroke bg-card p-4 shadow-soft sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl border border-stroke bg-white/70 px-4 py-3 font-sans font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
              <span>{t("docs.integrations.viewPython")}</span>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:hidden">
                {t("docs.integrations.expand")}
              </span>
              <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:inline">
                {t("docs.integrations.collapse")}
              </span>
            </summary>
          <div className="grid gap-4">
            <CopyCodeBlock className={codeBlockClass}>
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
            </CopyCodeBlock>

            <CopyCodeBlock className={codeBlockClass}>
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
        # Optionally send invoice["receipt_url"] to your customer from your own system.
        pass

    return None`}</code>
            </CopyCodeBlock>
          </div>
          </details>
        </section>

        <section
          id="go"
          className="mt-12 grid scroll-mt-24 gap-8 border-t border-stroke pt-8"
          aria-labelledby="go-title"
        >
          <RecipeHeader t={t} id="go" index="06" title="Go">
            <p className="text-ink-soft">
              {rich(t("docs.integrations.goIntro"), { code: mono })}
            </p>
          </RecipeHeader>
          <details className="group grid gap-4 rounded-surface border border-stroke bg-card p-4 shadow-soft sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl border border-stroke bg-white/70 px-4 py-3 font-sans font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
              <span>{t("docs.integrations.viewGo")}</span>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:hidden">
                {t("docs.integrations.expand")}
              </span>
              <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft group-open:inline">
                {t("docs.integrations.collapse")}
              </span>
            </summary>
          <div className="grid gap-4">
            <CopyCodeBlock className={codeBlockClass}>
              <code>
                {`// create_invoice.go
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
  ID         string ` +
                  '`json:"id"`' +
                  `
  InvoiceURL string ` +
                  '`json:"invoice_url"`' +
                  `
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
}`}
              </code>
            </CopyCodeBlock>

            <CopyCodeBlock className={codeBlockClass}>
              <code>
                {`// webhook_server.go
package main

import (
  "encoding/json"
  "net/http"
  "os"
)

type webhookPayload struct {
  Event   string ` +
                  '`json:"event"`' +
                  `
  Invoice struct {
    Metadata map[string]any ` +
                  '`json:"metadata"`' +
                  `
  } ` +
                  '`json:"invoice"`' +
                  `
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
}`}
              </code>
            </CopyCodeBlock>
          </div>
          </details>
        </section>
      </div>
    </main>
  );
}
