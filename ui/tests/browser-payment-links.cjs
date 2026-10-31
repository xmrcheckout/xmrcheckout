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
    console.log("Payment-link browser checks passed at 320/390/768/1440px, enlarged text, keyboard, clipboard, graphic preview, and copied cross-origin embed through invoice creation without JavaScript.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
