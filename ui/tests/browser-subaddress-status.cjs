const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const base = process.argv[2];
  const fixture = process.argv[3] || "http://127.0.0.1:8000";
  const setState = async (state, delay = 0) => {
    const response = await fetch(fixture + "/__fixture", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, delay }),
    });
    assert.equal(response.status, 200);
  };
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      await context.addCookies([{ name: "xmrcheckout_api_key", value: "fixture-only-api-key", url: base }]);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const tab of ["overview", "invoices", "health"]) {
        await setState("ready", tab === "overview" ? 800 : 0);
        await page.goto(base + "/dashboard?tab=" + tab, { waitUntil: tab === "overview" ? "commit" : "networkidle" });
        if (tab === "overview") await page.getByText("Loading dashboard and invoice address availability…", { exact: true }).waitFor();
        const panel = page.getByRole("region", { name: "Invoice address availability", exact: true });
        await panel.getByRole("heading", { name: "Invoice address availability" }).waitFor();
        await page.waitForLoadState("networkidle");
        await page.addStyleTag({ content: "html { font-size: 125%; }" });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}/${tab} overflow`);
        assert.match(await panel.innerText(), /Eligible addresses\s+2/);
        if (tab === "health") {
          await panel.getByText("Address details (5)", { exact: true }).focus();
          await page.keyboard.press("Enter");
          await panel.getByText("Index 3: Awaiting invoice status update", { exact: true }).waitFor();
          await panel.getByText("Related invoices (1)", { exact: true }).focus();
          await page.keyboard.press("Enter");
          assert.match(await panel.getByRole("link", { name: /000000000456/ }).getAttribute("href"), /archived=1/);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await page.screenshot({ path: `/tmp/subaddress-health-${width}.png`, fullPage: true });
          const refresh = panel.getByRole("button", { name: "Refresh availability" });
          await setState("snapshot_failed", 600);
          await refresh.focus();
          await page.keyboard.press("Enter");
          await panel.getByRole("button", { name: "Refreshing…" }).waitFor();
          await panel.getByText("The view-only wallet is still syncing.", { exact: false }).waitFor();
          await panel.getByRole("button", { name: "Copy reference ID" }).click();
          await panel.getByRole("status").filter({ hasText: /Reference ID copied|Could not copy/ }).waitFor();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await setState("recovered");
          await panel.getByRole("button", { name: "Refresh availability" }).click();
          await panel.getByText(/Latest attempt:.*Successful/).waitFor();
          assert.equal(await panel.getByText("The view-only wallet is still syncing.", { exact: false }).count(), 0);
          await panel.getByText(/Last successful snapshot:.*2026-10-29/).waitFor();
        }
      }
      await setState("unavailable");
      await page.goto(base + "/dashboard?tab=invoices", { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "html { font-size: 125%; }" });
      const panel = page.getByRole("region", { name: "Invoice address availability", exact: true });
      await panel.getByText("Unavailable. Refresh to try again.").waitFor();
      assert.equal(await panel.getByText("Eligible addresses", { exact: true }).count(), 0);
      await page.getByRole("button", { name: /^Create invoice$/i }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(/Amount \(XMR\)/i).fill("0.3");
      const recipient = dialog.getByLabel("Recipient name");
      await dialog.getByText("Customer display", { exact: true }).click();
      await recipient.fill("Fixture recipient");
      for (const [amount, text] of [["0.3", "No invoice addresses are currently eligible."], ["0.4", "Invoice detection is busy. Try again shortly."], ["0.5", "The view-only snapshot failed. An address could not be safely reused."]]) {
        await dialog.getByLabel(/Amount \(XMR\)/i).fill(amount);
        await dialog.locator("button[type=submit]").click();
        await dialog.getByText(text, { exact: true }).waitFor();
        assert.equal(await dialog.getByLabel(/Amount \(XMR\)/i).inputValue(), amount);
        assert.equal(await recipient.inputValue(), "Fixture recipient");
        if (amount !== "0.5") await dialog.getByText("Try again in 5 seconds.", { exact: true }).waitFor();
        await dialog.getByRole("link", { name: "View System health" }).waitFor();
        await dialog.getByText(/Reference ID:/).waitFor();
        if (amount === "0.3") await panel.getByRole("status").filter({ hasText: "No invoice addresses are currently eligible." }).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (amount === "0.5") await page.screenshot({ path: `/tmp/subaddress-dialog-${width}.png`, fullPage: true });
      }
      await dialog.getByLabel(/Amount \(XMR\)/i).fill("0.2");
      await dialog.locator("button[type=submit]").click();
      await dialog.getByText("Invoice created", { exact: true }).first().waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, availabilityStates: "passed", keyboard: "passed", preservedForm: "passed", enlargedText: "passed" }));
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
