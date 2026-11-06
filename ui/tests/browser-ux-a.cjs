const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const base = process.argv[2] || "http://127.0.0.1:3336";
const fixture = process.argv[3] || "http://127.0.0.1:8035";
const id = "00000000-0000-4000-8000-000000000456";
const paymentLinkId = "00000000-0000-4000-8000-000000000777";
const buyerRoutes = ["/invoice/", "/donate/", "/i/"];
const defaultState = {
  invoiceStatus: "pending", invoiceResponseStatus: 200, invoiceExpiry: "default",
  confirmationTarget: 2, confirmations: null, checkingDelayed: false,
  invoiceQuote: "default", amountPaid: null, amountRemaining: null,
  invoiceTransportFailure: false, checkoutStyle: "standard",
};
const delayedText = "Payment checking is delayed right now. Payments sent to this address still go directly to the merchant's wallet and will appear here once checking resumes.";
const seenHeading = "Payment seen on the network. It is not yet in a block.";

async function state(options = {}) {
  const response = await fetch(fixture + "/__fixture", {
    method: "POST", body: JSON.stringify({ ...defaultState, ...options }),
  });
  assert.equal(response.status, 200, "Fixture state update");
}

async function goto(page, path) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.getByRole("main").waitFor();
}

async function assertNoOverflow(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
  let originalPaymentLink;
  try {
    const context = await browser.newContext({ reducedMotion: "reduce", locale: "en-US" });
    await context.addInitScript(() => {
      window.fixtureParentMessages = [];
      const postMessage = window.postMessage;
      window.postMessage = function (message, ...args) {
        window.fixtureParentMessages.push(message);
        return postMessage.call(this, message, ...args);
      };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);

    await state({ invoiceStatus: "confirmed" });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await goto(page, `/i/${id}/receipt`);
      await page.waitForFunction(() => window.fixtureParentMessages.some(message => message && message.status === "Settled"));
      assert.equal(await page.locator('img[src*="/qr/"], img[alt*="QR"], a[href^="monero:"]').count(), 0, "Receipt must not ask for another payment");
      await assertNoOverflow(page, `Receipt at ${width}px`);
      await page.evaluate(() => document.documentElement.style.fontSize = "200%");
      await assertNoOverflow(page, `Receipt enlarged at ${width}px`);
      await page.evaluate(() => document.documentElement.style.fontSize = "");
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.locator('img[src*="/qr/"], a[href^="monero:"]').count(), 0, "Printed receipt must not include a payment request");
      await assertNoOverflow(page, `Printed receipt at ${width}px`);
      await page.emulateMedia({ media: "screen" });
    }
    for (const options of [{ invoiceResponseStatus: 503 }, { invoiceTransportFailure: true }]) {
      await state(options);
      await goto(page, `/i/${id}/receipt`);
      await page.getByRole("heading", { name: "Status unavailable", exact: true }).waitFor();
      // Let mount effects finish: the successful receipt above proves that the
      // wrapper observes the actual bridge calls, including messages to parent.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.deepEqual(await page.evaluate(() => window.fixtureParentMessages.filter(message => message && message.status === "Invalid")), [], "Unavailable status must not report an invalid invoice to the store");
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const route of buyerRoutes) {
      for (const [count, heading] of [[0, seenHeading], [1, "Payment confirmed on-chain at 1 confirmation."], [3, "Payment confirmed on-chain at 3 confirmations."]]) {
        await state({ invoiceStatus: "confirmed", confirmationTarget: 0, confirmations: count });
        await goto(page, route + id);
        await page.getByRole("heading", { name: heading, exact: true }).waitFor();
        assert.equal(await page.getByRole("heading", { name: heading, exact: true }).count(), 1, route + " zero-target heading appears once");
      }
      for (const [invoiceStatus, heading] of [["payment_detected", "Payment detected. 1/2 confirmations."], ["confirmed", "Payment confirmed on-chain at 2 confirmations."]]) {
        await state({ invoiceStatus });
        await goto(page, route + id);
        await page.getByRole("heading", { name: heading, exact: true }).waitFor();
        assert.equal(await page.getByRole("heading", { name: heading, exact: true }).count(), 1, route + " status heading appears once");
        if (route !== "/i/") {
          assert.equal(await page.getByRole("main").locator(":scope > header > div").innerText(), "", route + " intro does not repeat status");
        }
      }
      for (const invoiceStatus of ["pending", "partially_paid", "payment_detected", "confirmed", "expired", "invalid"]) {
        const payable = ["pending", "partially_paid"].includes(invoiceStatus);
        const partial = invoiceStatus === "partially_paid";
        await state({ invoiceStatus, invoiceQuote: null, amountPaid: partial ? "0.040000000000" : null, amountRemaining: partial ? "0.060000000000" : null });
        await goto(page, route + id);
        const amountLabel = partial ? "Remaining amount" : payable ? "Exact amount" : "Invoice amount";
        await page.getByText(amountLabel, { exact: true }).waitFor();
        assert.equal(await page.getByRole("link", { name: "Open wallet", exact: true }).count(), payable ? 1 : 0, route + " wallet action follows payable state");
        if (payable) {
          await page.getByText(/^Approx\. USD reference: /).waitFor();
          if (partial) {
            assert.match(await page.getByRole("link", { name: "Open wallet", exact: true }).getAttribute("href"), /tx_amount=0\.06$/);
            await page.getByText("Received 0.04 of 0.1 XMR.", { exact: true }).waitFor();
          }
        } else {
          assert.equal(await page.getByText(/^Approx\. USD reference: /).count(), 0, route + " completed/unavailable invoice has no current estimate");
          assert.equal(await page.getByText("Exact amount", { exact: true }).count(), 0);
        }
        if (route !== "/donate/") {
          await state({ invoiceStatus });
          await goto(page, route + id);
          await page.getByText(/^Merchant price: /).waitFor();
          await page.getByText("About this price", { exact: true }).click();
          await page.getByText(/Converted to XMR at 200 EUR\/XMR \(fixture\) at 2026-10-30 12:00:00 UTC\./).waitFor();
        }
      }
    }
    for (const route of ["/invoice/", "/donate/"]) {
      for (const invoiceStatus of ["pending", "partially_paid", "payment_detected"]) {
        await state({ invoiceStatus, checkingDelayed: true });
        await goto(page, route + id);
        await page.getByText(delayedText, { exact: true }).waitFor();
      }
      await state({ checkingDelayed: false });
      await goto(page, route + id);
      assert.equal(await page.getByText(delayedText, { exact: true }).count(), 0);
    }
    for (const invoiceResponseStatus of [404, 503]) {
      await state({ invoiceResponseStatus });
      await goto(page, "/donate/" + id);
      await page.getByRole("heading", { name: invoiceResponseStatus === 404 ? "Donation invoice not found" : "Status unavailable", exact: true }).waitFor();
      assert.equal(await page.getByLabel("Invoice ID or link", { exact: true }).count(), 0, "Donation errors must not offer the general invoice lookup");
      assert.equal(await page.locator('form[action="/invoice"]').count(), 0);
    }

    await state();
    originalPaymentLink = (await (await fetch(fixture + "/api/core/payment-links")).json())[0];
    const response = await fetch(fixture + "/api/core/payment-links/" + paymentLinkId, {
      method: "PATCH", body: JSON.stringify({ amount_xmr: "0.100000000000", customer_amount: false, auto_create_invoice: false, enabled: true }),
    });
    assert.equal(response.status, 200);
    await goto(page, "/pay/fixture-token");
    await page.getByText("0.1 XMR", { exact: true }).waitFor();
    assert.equal((await page.getByRole("main").innerText()).includes("0.100000000000 XMR"), false);
    await context.addCookies([{ name: "xmrcheckout_api_key", value: "fixture-only-api-key", url: base }]);
    await goto(page, "/dashboard?tab=payment-links");
    await page.locator("tbody tr").getByText("0.1 XMR", { exact: true }).waitFor();
    assert.equal((await page.locator("tbody").innerText()).includes("0.100000000000 XMR"), false);

    await goto(page, "/terminal/demo");
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: "Charge", exact: true }).click();
    await page.getByRole("button", { name: "Simulate payment seen", exact: true }).waitFor();
    assert.equal((await page.getByRole("main").innerText()).includes("Watching for payment"), false, "Demo must not claim network checking");
    assert.match(await page.getByRole("main").innerText(), /simulated/i);
    await context.close();
    console.log("Buyer UX: receipt safety, confirmation wording, amount labels, quotes, delays, donation errors, link amounts, and demo honesty passed.");
  } finally {
    if (originalPaymentLink) {
      await fetch(fixture + "/api/core/payment-links/" + paymentLinkId, {
        method: "PATCH", body: JSON.stringify({ customer_amount: false, auto_create_invoice: false, ...originalPaymentLink }),
      });
    }
    await state();
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
