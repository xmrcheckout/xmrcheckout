const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const QRCode = require("qrcode");
const axePath = require.resolve("axe-core/axe.min.js");

async function axeViolations(page) {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }));
  return result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(", ")}`);
}

async function main() {
  const base = process.argv[2] || "http://127.0.0.1:3300";
  const merchant = process.argv[3];
  assert.ok(merchant, "A separate merchant origin is required");
  assert.notEqual(new URL(base).origin, new URL(merchant).origin);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox", "--ignore-certificate-errors"] });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      await context.addCookies([{ name: "xmrcheckout_api_key", value: "fixture-only-api-key", url: base }]);
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.goto(base + "/dashboard?tab=payment-links", { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Payment links", exact: true }).waitFor();
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      const row = page.locator("tbody tr").filter({ has: page.locator('a[href$="/pay/fixture-token"]') });
      await row.getByRole("button", { name: "Copy link for Fixture product", exact: true }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), base + "/pay/fixture-token");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `list overflow ${width}`);
      if (width === 1440) assert.deepEqual(await axeViolations(page), [], "Payment links list must pass WCAG 2.1 AA");
      await row.getByRole("link", { name: "Manage Fixture product", exact: true }).click();
      await page.getByRole("heading", { name: "Fixture product", level: 1 }).waitFor();
      const detailUrl = page.url();
      assert.match(detailUrl, /tab=payment-links&link=/);
      const card = page.locator("#main-content");
      const preview = card.getByRole("link", { name: "Buy with Monero via xmrcheckout", exact: true });
      await preview.scrollIntoViewIfNeeded();
      await preview.getByRole("img").evaluate(image => image.decode());
      assert.equal(await preview.getAttribute("href"), base + "/pay/fixture-token");
      await page.getByRole("region", { name: "Button for your website", exact: true }).getByRole("button", { name: "Copy code", exact: true }).click();
      const snippet = await page.evaluate(() => navigator.clipboard.readText());
      assert.match(snippet, /<a href=/);
      assert.match(snippet, /<img src=/);
      assert.equal(snippet.includes("<form"), false);
      assert.equal((await fetch(merchant, { method: "POST", body: snippet })).status, 204);
      if (width === 1440) {
        const badges = page.getByRole("region", { name: "“Monero accepted here” badge" });
        await badges.getByRole("img", { name: "Monero accepted here" }).first().evaluate(image => image.decode());
        await badges.getByRole("button", { name: "Copy code", exact: true }).first().click();
        const badgeSnippet = await page.evaluate(() => navigator.clipboard.readText());
        assert.match(badgeSnippet, /^<a href="[^"]+\/pay\/fixture-token">\n  <img src="[^"?]+\/badges\/monero-accepted-here\.svg" alt="Monero accepted here"/);
        assert.equal((await fetch(badgeSnippet.match(/src="([^"]+)"/)[1].replace(/^https?:\/\/[^/]+/, base))).status, 200);
        assert.deepEqual(await axeViolations(page), [], "Payment link detail must pass WCAG 2.1 AA");
        await card.getByRole("link", { name: "Printable sign with QR code", exact: true }).click();
        await page.getByRole("heading", { name: "Printable sign", exact: true }).waitFor();
        const sign = page.getByRole("article", { name: "Sign preview" });
        await sign.getByText("0.1 XMR", { exact: true }).waitFor();
        await sign.getByText("Scan to pay with Monero", { exact: true }).waitFor();
        const qr = sign.getByRole("img", { name: "QR code for this payment link" });
        await qr.evaluate(image => image.decode());
        const expectedSvg = await QRCode.toString(base + "/pay/fixture-token", { type: "svg", margin: 1, errorCorrectionLevel: "M" });
        assert.equal(decodeURIComponent((await qr.getAttribute("src")).split(",")[1]), expectedSvg, "Sign QR must encode the payment link URL");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(await axeViolations(page), [], "Sign page must pass WCAG 2.1 AA");
        await page.emulateMedia({ media: "print" });
        assert.equal(await page.locator(".site-header").isVisible(), false, "Print must hide the site header");
        assert.equal(await page.getByRole("button", { name: "Print sign" }).isVisible(), false, "Print must hide controls");
        assert.equal(await qr.isVisible(), true);
        await page.emulateMedia({ media: "screen" });
        await page.getByRole("link", { name: "Back to payment links", exact: true }).click();
        await page.getByRole("heading", { name: "Payment links", exact: true }).waitFor();
        await page.goto(base + "/dashboard/payment-links/00000000-0000-4000-8000-000000000000/sign");
        await page.getByRole("alert").filter({ hasText: "This payment link was not found." }).waitFor();
        await page.goto(detailUrl, { waitUntil: "networkidle" });
      }
      if (width === 320) {
        const settings = page.getByRole("region", { name: "Settings", exact: true });
        const skipReview = settings.getByRole("checkbox", { name: "Skip review and create invoice automatically" });
        await skipReview.check();
        await settings.getByLabel("Button text", { exact: true }).fill("Donate & <Monero>");
        const message = "Thanks!\nDownload: https://merchant.example/book-1.pdf";
        await settings.getByLabel("Confirmation message (optional)", { exact: true }).fill(message);
        await settings.getByRole("button", { name: "Save payment link", exact: true }).click();
        await settings.getByRole("status").filter({ hasText: "Payment link saved" }).waitFor();
        assert.equal((await (await fetch(base + "/api/core/public/payment-links/fixture-token")).json()).auto_create_invoice, true);
        assert.equal(await skipReview.isChecked(), true, "Saved skip-review checkbox must remain checked");
        const customized = card.getByRole("img", { name: "Donate & <Monero> via xmrcheckout", exact: true });
        await customized.evaluate(image => image.decode());
        const graphicUrl = await customized.getAttribute("src");
        const graphic = await (await fetch(graphicUrl)).text();
        assert.ok(graphic.includes("Donate &amp; &lt;Monero&gt;"));
        await page.getByRole("region", { name: "Button for your website", exact: true }).getByRole("button", { name: "Copy code", exact: true }).click();
        const customHtml = await page.evaluate(() => navigator.clipboard.readText());
        assert.ok(customHtml.includes("Donate &amp; &lt;Monero&gt; via xmrcheckout"));
        assert.ok(customHtml.includes("/buttons/payment.svg?text="));
        await page.reload({ waitUntil: "networkidle" });
        assert.equal(await settings.getByLabel("Button text", { exact: true }).inputValue(), "Donate & <Monero>");
        assert.equal(await settings.getByLabel("Confirmation message (optional)", { exact: true }).inputValue(), message, "Confirmation message must survive reload");
        await settings.getByLabel("Button text", { exact: true }).fill("Buy with Monero");
        assert.equal(await skipReview.isChecked(), true, "Saved skip-review setting must survive reload");
        await skipReview.uncheck();
        await settings.getByRole("button", { name: "Save payment link", exact: true }).click();
        await settings.getByRole("status").filter({ hasText: "Payment link saved" }).waitFor();
        assert.equal(await skipReview.isChecked(), false, "Disabled skip-review checkbox must remain unchecked");
      }
      await page.addStyleTag({ content: "html { font-size: 125%; }" });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `dashboard overflow ${width}`);
      if (process.env.PAYMENT_LINK_SCREENSHOT_DIR) {
        await card.screenshot({ path: `${process.env.PAYMENT_LINK_SCREENSHOT_DIR}/payment-link-${width}.png` });
      }
      await page.goto(base + "/dashboard?tab=payment-links", { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "html { font-size: 125%; }" });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `list overflow at 125% ${width}`);
      await page.getByText("Create payment link", { exact: true }).focus();
      await page.keyboard.press("Enter");
      const editor = page.locator("details").filter({ hasText: "Create payment link" });
      await editor.getByLabel("Title", { exact: true }).fill("Fixture product");
      await editor.getByLabel("Fixed amount", { exact: true }).fill("0.1000000000001");
      await editor.getByRole("button", { name: "Save payment link" }).click();
      const amount = editor.getByLabel("Fixed amount", { exact: true });
      await page.waitForFunction(() => document.activeElement?.getAttribute("name") === "amount");
      assert.equal(await amount.getAttribute("aria-invalid"), "true");
      assert.equal(await amount.inputValue(), "0.1000000000001");
      assert.ok(await page.locator(`[id="${await amount.getAttribute("aria-describedby")}"]`).textContent());
      await amount.fill("0.1");
      await editor.getByRole("button", { name: "Save payment link" }).click();
      await editor.getByRole("status").filter({ hasText: "Payment link saved" }).waitFor();
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: /^Copy link for / }).first().click();
      const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
      assert.equal(copied.origin, new URL(base).origin);
      assert.match(copied.pathname, /^\/pay\/[A-Za-z0-9_-]+$/);
      await page.getByRole("region", { name: "Public invoice allowance", exact: true }).getByText(/remaining/).waitFor();
      await page.getByRole("button", { name: "Refresh allowance and addresses" }).click();
      await page.waitForLoadState("networkidle");
      if (width === 320) {
        await fetch(base + "/api/core/__fixture/failure?mode=allowance");
        await page.reload({ waitUntil: "networkidle" });
        await page.getByText("Allowance unavailable. Refresh to try again.", { exact: true }).waitFor();
        await page.getByText("Eligible addresses", { exact: true }).waitFor();
        await fetch(base + "/api/core/__fixture/failure?mode=addresses");
        await page.reload({ waitUntil: "networkidle" });
        await page.getByRole("region", { name: "Public invoice allowance", exact: true }).getByText(/remaining/).waitFor();
        await page.getByRole("region", { name: "Invoice address availability", exact: true }).getByText("Unavailable. Refresh to try again.", { exact: true }).waitFor();
        await fetch(base + "/api/core/__fixture/failure?mode=none");
      }
      await page.goto(detailUrl, { waitUntil: "networkidle" });
      await preview.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(base + "/pay/fixture-token");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `review overflow ${width}`);
      const paths = await (await fetch(base + "/api/core/__fixture/requests")).json();
      assert.equal(paths.includes("/api/core/public/payment-links/fixture-token/invoices"), false, "Preview navigation must not create an invoice");
      await context.close();
    }
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(merchant);
    const graphic = page.getByRole("link", { name: "Buy with Monero via xmrcheckout", exact: true });
    await graphic.getByRole("img").evaluate(image => image.decode());
    assert.equal(await graphic.getAttribute("href"), base + "/pay/fixture-token");
    await graphic.click();
    await page.waitForURL(base + "/pay/fixture-token");
    await page.getByRole("heading", { name: "Fixture product", exact: true }).waitFor();
    const requestPromise = page.waitForRequest(request => request.method() === "POST" && request.url().includes("/payment-links/fixture-token/invoices"));
    const responsePromise = page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/payment-links/fixture-token/invoices"));
    await page.getByRole("button", { name: "Continue to payment", exact: true }).click();
    const submitted = await requestPromise;
    assert.equal(new URL(submitted.url()).origin, new URL(base).origin);
    assert.equal(submitted.headers().origin, new URL(base).origin);
    assert.equal(submitted.headers().authorization, undefined);
    assert.equal((await responsePromise).status(), 303);
    await page.waitForURL(/\/invoice\//);
    await page.getByRole("heading", { name: "Fixture product" }).waitFor();
    const paths = await (await fetch(base + "/api/core/__fixture/requests")).json();
    assert.equal(paths.includes("/api/core/invoices"), false, "Payment links must not load invoice history");
    await context.close();
    const authorization = { Authorization: "ApiKey fixture-only-api-key" };
    const links = await (await fetch(base + "/api/core/payment-links", { headers: authorization })).json();
    const fixture = links.find(link => link.url.endsWith("/fixture-token"));
    const settings = { title: fixture.title, amount_xmr: "0.1", confirmation_target: 2, auto_create_invoice: true };
    assert.equal((await fetch(base + "/api/core/payment-links/" + fixture.id, {
      method: "PATCH", headers: { ...authorization, "Content-Type": "application/json" }, body: JSON.stringify(settings),
    })).status, 200);
    for (const width of [320, 390, 768, 1440]) {
      // Refill the real public purchase limiter before exercising creation and replay.
      await new Promise(resolve => setTimeout(resolve, 21000));
      const automatic = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      const checkout = await automatic.newPage();
      checkout.setDefaultTimeout(15000);
      if (width === 390) {
        await checkout.route("**/api/core/public/payment-links/fixture-token/invoices", async route => {
          await route.fetch();
          await route.abort();
        }, { times: 1 });
      }
      if (width === 768) {
        await checkout.addInitScript(() => Object.defineProperty(document, "prerendering", { configurable: true, value: true }));
      }
      await checkout.goto(base + "/pay/fixture-token");
      if (width === 768) {
        assert.equal(checkout.url(), base + "/pay/fixture-token");
        assert.equal(await checkout.evaluate(() => sessionStorage.getItem("payment-link-attempt:fixture-token")), null);
        await checkout.evaluate(() => {
          Object.defineProperty(document, "prerendering", { configurable: true, value: false });
          document.dispatchEvent(new Event("prerenderingchange"));
        });
      }
      if (width === 390) {
        await checkout.getByRole("button", { name: "Retry same checkout attempt" }).click();
      }
      await checkout.waitForURL(/\/invoice\//);
      const invoiceUrl = checkout.url();
      await checkout.addStyleTag({ content: "html { font-size: 125%; }" });
      assert.equal(await checkout.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      // Remove the simulated prerender flag on later documents.
      await checkout.goto(base + "/pay/fixture-token");
      if (width === 768) await checkout.evaluate(() => {
        Object.defineProperty(document, "prerendering", { configurable: true, value: false });
        document.dispatchEvent(new Event("prerenderingchange"));
      });
      await checkout.waitForURL(invoiceUrl);
      if (width === 320) {
        await checkout.getByRole("link", { name: "Start another purchase", exact: true }).click();
        await checkout.waitForURL(url => url.pathname.startsWith("/invoice/") && url.href !== invoiceUrl);
      }
      await automatic.close();
    }
    const fallback = await browser.newContext({ javaScriptEnabled: false });
    const manual = await fallback.newPage();
    await manual.goto(base + "/pay/fixture-token");
    await manual.getByRole("button", { name: "Continue to payment" }).waitFor();
    await fallback.close();
    const noStorage = await browser.newContext();
    await noStorage.addInitScript(() => Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Storage unavailable"); } }));
    const unavailableStorage = await noStorage.newPage();
    await unavailableStorage.goto(base + "/pay/fixture-token", { waitUntil: "networkidle" });
    await unavailableStorage.getByRole("button", { name: "Continue to payment" }).waitFor();
    await noStorage.close();
    console.log("Payment-link browser checks passed at 320/390/768/1440px, enlarged text, keyboard, clipboard, graphic preview, badge snippet, printable sign, copied cross-origin embed, automatic creation, resumption, explicit new purchase, response recovery, prerender protection, and manual fallbacks.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
