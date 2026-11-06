const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3347';
const fixture = process.argv[3] || 'http://127.0.0.1:8046';
const id = '00000000-0000-4000-8000-000000000456';
const configure = options => fetch(fixture + '/__fixture', { method: 'POST', body: JSON.stringify(options) });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const receipt of [false, true]) {
        await configure({ invoiceStatus: receipt ? 'confirmed' : 'pending', invoiceResponseStatus: 200 });
        await page.goto(base + '/i/' + id + (receipt ? '/receipt' : ''), { waitUntil: 'networkidle' });
        await page.locator('.site-header .brand-logo').waitFor();
        await page.locator('.site-footer').getByRole('link', { name: 'GitHub', exact: true }).waitFor();
        assert.equal(await page.getByRole('navigation', { name: 'Primary navigation' }).count(), 0);
        assert.equal(await page.getByRole('link', { name: 'Donate', exact: true }).count(), 0);
        assert.equal(await page.getByRole('combobox', { name: 'Language', exact: true }).count(), 1);
        await page.evaluate(() => document.documentElement.style.fontSize = '200%');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Enlarged compact document fits at ' + width);
        if (receipt) {
          assert.equal(await page.locator('img[src^="data:image"]').count(), 0, 'Receipt has no payable QR');
          await page.emulateMedia({ media: 'print' });
          assert.equal(await page.locator('.site-header').isVisible(), false);
          assert.equal(await page.locator('.site-footer').isVisible(), false);
          assert.equal(await page.getByRole('combobox', { name: 'Language', exact: true }).isVisible(), false);
          assert.equal(await page.getByRole('link', { name: 'Skip to main content' }).isVisible(), false);
          await page.emulateMedia({ media: 'screen' });
        }
      }
      console.log('Compact branding, widths, language selection and print passed:', width);
    }
    for (const failure of [{ status: 503 }, { disconnect: true }, { status: 200, malformed: true }]) {
      await configure({ dashboardFailure: { path: '/api/core/public/invoice/' + id, method: 'GET', ...failure } });
      await page.goto(base + '/i/' + id + '/receipt', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Status unavailable', exact: true }).waitFor();
      await configure({ dashboardFailure: null });
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await page.getByRole('button', { name: 'Print', exact: true }).waitFor();
    }
    await page.goto(base + '/tour');
    await page.evaluate(() => { window.checkoutMessages = []; addEventListener('message', event => window.checkoutMessages.push(event.data)); });
    await configure({ invoiceStatus: 'pending' });
    await page.evaluate(src => { const frame = document.createElement('iframe'); frame.id = 'checkout-fixture'; frame.src = src; frame.style.cssText = 'width:320px;height:480px'; document.body.append(frame); }, base + '/i/' + id);
    const frame = page.frameLocator('#checkout-fixture');
    await frame.getByRole('heading', { name: 'Payment request', exact: true }).waitFor();
    await page.waitForFunction(() => window.checkoutMessages.some(message => message?.status === 'New'));
    await frame.getByRole('link', { name: 'Open wallet', exact: true }).scrollIntoViewIfNeeded();
    await configure({ invoiceResponseStatus: 503 });
    await page.evaluate(src => { window.checkoutMessages = []; document.querySelector('#checkout-fixture').src = src; }, base + '/i/' + id);
    await frame.getByRole('heading', { name: 'Status unavailable', exact: true }).waitFor();
    await frame.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.checkoutMessages.some(message => message?.status)), false, 'An outage invents no BTCPay invoice state');
  } finally { await configure({ invoiceStatus: 'pending', invoiceResponseStatus: 200, dashboardFailure: null }); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
