const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const base = process.argv[2] || "http://127.0.0.1:3336";
const fiatCurrencies = [
  "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "JPY", "CNY", "HKD",
  "SGD", "INR", "BRL", "MXN", "SEK", "NOK", "DKK", "ZAR", "PLN", "KRW",
];

async function visit(page, path) {
  const response = await page.goto(base + path, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200, path + " responds successfully");
  await page.getByRole("main").waitFor();
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      locale: "en-US",
      extraHTTPHeaders: { "Accept-Language": "en" },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    // Exercise the public tour without submitting forms or touching merchant data.
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await visit(page, "/tour?tab=payment-links");
      const allowance = page.getByRole("region", { name: "Public invoice allowance", exact: true });
      await allowance.getByText("7 remaining · 3 used · Limit 10 per rolling 24 hours", { exact: true }).waitFor();
      const linkEditor = page.locator("details").filter({
        has: page.locator("summary").filter({ hasText: /^Create payment link$/ }),
      });
      await linkEditor.locator("summary").click();
      assert.deepEqual(
        await linkEditor.getByLabel("Amount currency", { exact: true }).locator("option").evaluateAll(options => options.map(option => option.value)),
        ["XMR", ...fiatCurrencies],
        "Tour payment-link creation offers all 20 supported reference currencies at " + width,
      );
      assert.equal(
        await linkEditor.getByLabel("Required confirmations", { exact: true }).inputValue(),
        "1",
        "New tour payment links inherit the account default of 1 at " + width,
      );

      await visit(page, "/tour?tab=invoices");
      await page.getByRole("button", { name: "Create invoice", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      const advanced = dialog.locator("details").filter({
        has: page.locator("summary").filter({ hasText: /^Confirmation and expiry$/ }),
      });
      await advanced.locator("summary").click();
      const mode = dialog.locator("#wizard_confirmation_mode");
      assert.equal(await mode.inputValue(), "account_default");
      assert.equal(await mode.locator("option:checked").innerText(), "Account default (1)");
      await mode.selectOption("custom");
      assert.equal(await dialog.locator("#wizard_confirmation_target").inputValue(), "1");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      console.log("Tour defaults and currencies passed:", width);
    }

    await context.close();
    console.log("Tour defaults, invoice creation defaults and currency choices passed at all four widths.");
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
