const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const base = process.argv[2];
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const path of ["/", "/login", "/tour?tab=invoice"]) {
        assert.equal((await page.goto(base + path, { waitUntil: "networkidle" })).status(), 200);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, responsivePages: "passed" }));
      await context.close();
    }

    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/?login=1", { waitUntil: "networkidle" });
    await page.getByLabel("Primary address", { exact: true }).fill("4" + "1".repeat(94));
    await page.getByLabel("Secret view key", { exact: true }).fill("1".repeat(64));
    await page.getByText("Address and view key match", { exact: true }).waitFor();
    await page.getByRole("dialog").locator("button[type=submit]").click();
    await page.waitForURL("**/dashboard");
    await page.goto(base + "/dashboard?tab=invoices", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^create invoice$/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Amount \(XMR\)/i).fill("0.1");
    await dialog.locator("button[type=submit]").click();
    await dialog.getByText("Fixture invoice service unavailable", { exact: true }).waitFor();
    await dialog.getByLabel(/Amount \(XMR\)/i).fill("0.2");
    await dialog.locator("button[type=submit]").click();
    await dialog.getByText("Invoice created", { exact: true }).first().waitFor();
    assert.match(await dialog.getByRole("link", { name: /open invoice/i }).getAttribute("href"), /fixture-invoice-created/);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ fixtureLogin: "passed", invoiceFailure: "passed", invoiceSuccess: "passed" }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
