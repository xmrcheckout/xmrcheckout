const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const base = process.argv[2] || "http://127.0.0.1:3300";
  const merchant = process.argv[3];
  assert.ok(merchant, "A separate merchant origin is required");
  assert.notEqual(new URL(base).origin, new URL(merchant).origin);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      await context.addCookies([{ name: "xmrcheckout_api_key", value: "fixture-only-api-key", url: base }]);
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.goto(base + "/dashboard?tab=payment-links", { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Payment links", exact: true }).waitFor();
      const card = page.locator("article").filter({ has: page.locator('a[href$="/pay/fixture-token"]') });
      const preview = card.getByRole("link", { name: "Buy with Monero via xmrcheckout", exact: true });
      await preview.scrollIntoViewIfNeeded();
      await preview.getByRole("img").evaluate(image => image.decode());
      assert.equal(await preview.getAttribute("href"), base + "/pay/fixture-token");
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await card.getByRole("button", { name: "Copy code", exact: true }).nth(1).click();
      const snippet = await page.evaluate(() => navigator.clipboard.readText());
      assert.match(snippet, /<a href=/);
      assert.match(snippet, /<img src=/);
      assert.equal(snippet.includes("<form"), false);
      assert.equal((await fetch(merchant, { method: "POST", body: snippet })).status, 204);
      if (width === 320) {
        const settings = card.locator("details");
        await settings.locator("summary").click();
        const skipReview = settings.getByRole("checkbox", { name: "Skip review and create invoice automatically" });
        await skipReview.check();
        await settings.getByRole("button", { name: "Save payment link", exact: true }).click();
        await settings.getByRole("status").filter({ hasText: "Payment link saved" }).waitFor();
        assert.equal((await (await fetch(base + "/api/core/public/payment-links/fixture-token")).json()).auto_create_invoice, true);
        assert.equal(await skipReview.isChecked(), true, "Saved skip-review checkbox must remain checked");
        await page.reload({ waitUntil: "networkidle" });
        await settings.locator("summary").click();
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
      await page.getByText("Create payment link", { exact: true }).focus();
      await page.keyboard.press("Enter");
      const editor = page.locator("details").filter({ hasText: "Create payment link" });
      await editor.getByLabel("Title", { exact: true }).fill("Fixture product");
      await editor.getByLabel("Fixed amount").fill("0.1000000000001");
      await editor.getByRole("button", { name: "Save payment link" }).click();
      const amount = editor.getByLabel("Fixed amount");
      await page.waitForFunction(() => document.activeElement?.getAttribute("name") === "amount");
      assert.equal(await amount.getAttribute("aria-invalid"), "true");
      assert.equal(await amount.inputValue(), "0.1000000000001");
      assert.ok(await page.locator(`[id="${await amount.getAttribute("aria-describedby")}"]`).textContent());
      await amount.fill("0.1");
      await editor.getByRole("button", { name: "Save payment link" }).click();
      await editor.getByRole("status").filter({ hasText: "Payment link saved" }).waitFor();
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: "Copy code", exact: true }).first().click();
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
    await page.getByRole("button", { name: "Create invoice and pay with Monero", exact: true }).click();
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
    await manual.getByRole("button", { name: "Create invoice and pay with Monero" }).waitFor();
    await fallback.close();
    const noStorage = await browser.newContext();
    await noStorage.addInitScript(() => Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Storage unavailable"); } }));
    const unavailableStorage = await noStorage.newPage();
    await unavailableStorage.goto(base + "/pay/fixture-token", { waitUntil: "networkidle" });
    await unavailableStorage.getByRole("button", { name: "Create invoice and pay with Monero" }).waitFor();
    await noStorage.close();
    console.log("Payment-link browser checks passed at 320/390/768/1440px, enlarged text, keyboard, clipboard, graphic preview, copied cross-origin embed, automatic creation, resumption, explicit new purchase, response recovery, prerender protection, and manual fallbacks.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
