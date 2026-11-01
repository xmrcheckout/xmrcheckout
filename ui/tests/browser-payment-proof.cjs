const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const KEY = "b".repeat(64);
const SIGNATURE = "OutProofV2" + "2".repeat(132);
const failingTxid = "9".repeat(64);

async function main() {
  const base = process.argv[2];
  const fixture = process.argv[3] || "http://127.0.0.1:8000";
  const lastBody = async () => (await (await fetch(fixture + "/__fixture/proof")).json()).body;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  try {
    for (const width of [320, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      await context.addCookies([{ name: "xmrcheckout_api_key", value: "fixture-only-api-key", url: base }]);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const proofRequests = [];
      page.on("request", (request) => proofRequests.push(request.url()));

      await page.goto(base + "/dashboard?tab=invoices", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Details", exact: true }).locator("visible=true").first().click();
      const opener = page.getByRole("button", { name: "Check payment proof", exact: true }).locator("visible=true").first();
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "Check payment proof" });
      await dialog.getByText("a".repeat(64)).waitFor();
      await dialog.getByText(/does not change the invoice/).waitFor();
      const submit = dialog.getByRole("button", { name: "Check proof", exact: true });
      assert.equal(await submit.isDisabled(), true);

      const txid = dialog.getByLabel("Transaction ID", { exact: true });
      const key = dialog.getByLabel("Transaction key", { exact: true }).and(dialog.locator("textarea"));

      // A failed check stays distinct from no match, and keeps the input for a retry.
      await txid.fill(failingTxid);
      await key.fill(KEY);
      await submit.click();
      const alert = dialog.getByRole("alert");
      await alert.getByText("Could not complete this check").waitFor();
      assert.equal(await key.inputValue(), KEY);
      assert.equal(await dialog.getByRole("radio", { name: "Transaction key" }).isChecked(), true);
      assert.equal(await dialog.getByText("Proof does not match this invoice").count(), 0);

      // An answer clears the secret but keeps the transaction ID.
      await txid.fill("a".repeat(64));
      await submit.click();
      await dialog.getByText("Proof matches, and this invoice records the payment").waitFor();
      await dialog.getByText(/0\.1 XMR was sent to this invoice's address in this transaction, with 3 confirmations/).waitFor();
      assert.equal(await key.inputValue(), "");
      assert.equal(await txid.inputValue(), "a".repeat(64));
      assert.deepEqual(await lastBody(), { txid: "a".repeat(64), tx_key: KEY });

      // Each result is explained, and non-matching results claim nothing about funds.
      for (const [letter, title] of [
        ["b", "Proof matches, but the payment belongs to another invoice"],
        ["c", "Proof matches, but the payment came before this invoice"],
        ["d", "Proof matches, but this invoice does not record the payment"],
        ["e", "Proof does not match this invoice"],
        ["f", "Transaction not found"],
      ]) {
        await txid.fill(letter.repeat(64));
        await key.fill(KEY);
        await submit.click();
        await dialog.getByText(title, { exact: true }).waitFor();
        if (letter === "e" || letter === "f") {
          assert.equal(await dialog.getByText(/XMR was sent to this invoice/).count(), 0);
        }
      }

      // The signed message reaches the API byte for byte.
      await dialog.getByRole("radio", { name: "Signature" }).check();
      await txid.fill("a".repeat(64));
      await dialog.getByLabel("Signature", { exact: true }).and(dialog.locator("textarea")).fill(SIGNATURE);
      await dialog.getByLabel("Signed message", { exact: true }).fill(" order 1 ");
      await submit.click();
      await dialog.getByText(/not made specifically for this invoice/).waitFor();
      assert.deepEqual(await lastBody(), { txid: "a".repeat(64), signature: SIGNATURE, message: " order 1 " });
      const signatureField = dialog.getByLabel("Signature", { exact: true }).and(dialog.locator("textarea"));
      assert.equal(await signatureField.inputValue(), "");
      // The chosen proof type survives a check, so a second signature can follow.
      assert.equal(await dialog.getByRole("radio", { name: "Signature" }).isChecked(), true);
      assert.equal(await dialog.getByRole("radio", { name: "Transaction key" }).isChecked(), false);
      await signatureField.fill(SIGNATURE);
      await dialog.getByLabel("Signed message", { exact: true }).fill("order 2");
      await submit.click();
      await dialog.getByText("Checking...", { exact: true }).first().waitFor({ state: "detached" });
      assert.deepEqual(await lastBody(), { txid: "a".repeat(64), signature: SIGNATURE, message: "order 2" });
      assert.equal(await dialog.getByRole("radio", { name: "Signature" }).isChecked(), true);

      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} page overflow`);
      assert.equal(await dialog.evaluate((node) => node.scrollWidth > node.clientWidth), false, `${width} dialog overflow`);
      await page.screenshot({ path: `${process.env.SCREENSHOT_DIR || "/tmp"}/payment-proof-${width}.png` });

      // Secrets never appear in a URL, and Escape returns focus to the opener.
      assert.equal(proofRequests.some((url) => url.includes(KEY) || url.includes("OutProofV2")), false);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      assert.equal(await opener.evaluate((node) => node === document.activeElement), true);
      assert.deepEqual(errors, []);
      await context.close();
    }

    const tour = await browser.newPage();
    await tour.goto(base + "/tour", { waitUntil: "networkidle" });
    const details = tour.getByRole("button", { name: "Details", exact: true }).locator("visible=true");
    if (await details.count()) await details.first().click();
    assert.equal(await tour.getByRole("button", { name: "Check payment proof" }).count(), 0);
    console.log("payment proof browser checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
