const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const base = process.argv[2] || "http://127.0.0.1:3300";
  const fixture = process.argv[3] || "http://127.0.0.1:18080";
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      await context.addCookies([{ name: "xmrcheckout_api_key", value: "fixture-only-api-key", url: base }]);
      const page = await context.newPage();
      await page.goto(base + "/dashboard?tab=payment-links", { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Payment links", exact: true }).waitFor();
      await page.addStyleTag({ content: "html { font-size: 125%; }" });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `dashboard overflow ${width}`);
      await page.getByText("Create payment link", { exact: true }).focus();
      await page.keyboard.press("Enter");
      const editor = page.locator("details").filter({ hasText: "Create payment link" });
      await editor.getByLabel("Title", { exact: true }).fill("Fixture product");
      await editor.getByLabel("Fixed amount").fill("0.1");
      await editor.getByRole("button", { name: "Save payment link" }).click();
      await editor.getByRole("status").filter({ hasText: "Payment link saved" }).waitFor();
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: "Copy code", exact: true }).first().click();
      assert.match(await page.evaluate(() => navigator.clipboard.readText()), /pay\/fixture-token/);
      await page.goto(base + "/pay/fixture-token", { waitUntil: "networkidle" });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `review overflow ${width}`);
      await context.close();
    }
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    // The fixture origin is separate from the hosted UI. No cookie or script is needed.
    await page.goto(fixture + "/merchant-page");
    await page.setContent(`<form method="post" action="${fixture}/api/core/public/payment-links/fixture-token/invoices"><button>Buy with Monero</button></form>`);
    await page.getByRole("button", { name: "Buy with Monero" }).click();
    await page.waitForURL(/\/invoice\//);
    await page.getByRole("heading", { name: "Fixture product" }).waitFor();
    await page.getByText(/Source: fixture/).waitFor();
    await context.close();
    console.log("Payment-link browser checks passed at 320/390/768/1440px, enlarged text, keyboard, clipboard, and cross-origin submission without JavaScript.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
