const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3336';
const api = process.argv[3] || 'http://127.0.0.1:8035';
const id = '00000000-0000-4000-8000-000000000456';
const deadline = '2099-10-31T16:25:26Z';
async function fixture(options) {
  const response = await fetch(api + '/__fixture', { method: 'POST', body: JSON.stringify(options) });
  assert.ok(response.ok);
}
async function noOverflow(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    for (const [timezoneId, locale] of [['Asia/Tokyo', 'en-GB'], ['America/New_York', 'en-US']]) {
      for (const javaScriptEnabled of [false, true]) {
        const context = await browser.newContext({ timezoneId, locale, javaScriptEnabled, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (/hydration|didn't match|did not match/i.test(message.text())) errors.push(message.text()); });
        for (const [path, checkoutStyle] of [[`/invoice/${id}`, 'standard'], [`/i/${id}`, 'standard'], [`/i/${id}`, 'btcpay_classic'], [`/donate/${id}`, 'standard']]) {
          await fixture({ invoiceStatus: 'pending', invoiceExpiry: deadline, checkoutStyle });
          for (const width of [320, 390, 768, 1440]) {
            await page.setViewportSize({ width, height: 844 });
            await page.goto(base + path, { waitUntil: 'domcontentloaded' });
            const expiry = page.locator('[data-invoice-expiry]');
            await expiry.waitFor();
            assert.match(await expiry.innerText(), /2099-10-31 16:25:26 UTC/);
            assert.ok(await page.getByText(/Status retrieved:/).count(), 'retrieval time retained');
            if (javaScriptEnabled) {
              await page.waitForFunction(() => /remaining/.test(document.querySelector('[data-invoice-expiry]').textContent));
              assert.equal(await expiry.locator('[aria-live=off]').count(), 1);
              assert.equal(await expiry.locator('[role=status],[aria-live=polite],[aria-live=assertive]').count(), 0);
              const qr = page.getByAltText('Payment request QR');
              await qr.waitFor();
              const e = await expiry.boundingBox(), q = await qr.boundingBox();
              if (width <= 768) assert.ok(e.y + e.height <= q.y, 'expiry precedes QR');
              assert.equal(await expiry.evaluate(e => getComputedStyle(e).animationName), 'none');
            } else {
              assert.match(await expiry.innerText(), /Refresh the page/);
              assert.equal(await page.locator('a[href^="monero:"]').count(), 1);
            }
            await noOverflow(page, `${path} ${width} ${locale} JS=${javaScriptEnabled}`);
            // Script execution through Playwright is also available in a JS-disabled
            // context; this changes only text size, without hydrating the page.
            await page.evaluate(() => document.documentElement.style.fontSize = '200%');
            await noOverflow(page, `${path} ${width} enlarged text`);
            await page.evaluate(() => document.documentElement.style.fontSize = '');
          }
          for (const [invoiceExpiry, text] of [[null, /No expiry time is set/], ['invalid', /Expiry time unavailable/], ['2020-01-01T00:00:00Z', /Expiry time has passed/]]) {
            await fixture({ invoiceExpiry });
            await page.goto(base + path, { waitUntil: 'domcontentloaded' });
            assert.match(await page.locator('[data-invoice-expiry]').innerText(), text);
            assert.equal(await page.getByText('Awaiting funds', { exact: true }).count() > 0, true, 'deadline does not invent expired status');
          }
          await fixture({ invoiceExpiry: deadline, invoiceStatus: 'payment_detected' });
          await page.goto(base + path, { waitUntil: 'domcontentloaded' });
          assert.equal(await page.locator('[data-invoice-expiry]').count(), 0, 'countdown only for pending');
        }
        // Receipt timestamp shares the same SSR-safe UTC output.
        await fixture({ invoiceStatus: 'confirmed', invoiceExpiry: deadline, checkoutStyle: 'standard' });
        await page.goto(`${base}/i/${id}/receipt`, { waitUntil: 'domcontentloaded' });
        assert.ok(await page.locator('time').count());
        for (const text of await page.locator('time').allTextContents()) assert.match(text, /UTC$/);
        assert.deepEqual(errors, [], 'no hydration errors');
        await context.close();
        console.log(`PASS expiry ${timezoneId} ${locale} JS=${javaScriptEnabled}`);
      }
    }
    await fixture({ invoiceStatus: 'pending', invoiceExpiry: 'soon', checkoutStyle: 'standard' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.goto(`${base}/invoice/${id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /remaining/.test(document.querySelector('[data-invoice-expiry]').textContent), null, { timeout: 10000 });
    const initial = await page.locator('[data-invoice-expiry]').innerText();
    await page.waitForFunction(text => document.querySelector('[data-invoice-expiry]').innerText !== text, initial, { timeout: 10000 });
    await page.getByText('Expiry time has passed. Status is being checked.', { exact: true }).waitFor();
    assert.ok(await page.getByText('Awaiting funds', { exact: true }).count());
    await fixture({ invoiceStatus: 'expired', invoiceExpiry: '2020-01-01T00:00:00Z' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('[data-invoice-expiry]').count(), 0);
    assert.ok(await page.getByText('Invoice expired. Do not send payment.', { exact: true }).count());
    console.log('PASS countdown crosses zero without inventing state; server expiry removes countdown');
    await page.close();
  } finally {
    await fixture({ invoiceStatus: 'pending', invoiceExpiry: 'default', checkoutStyle: 'standard' });
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
