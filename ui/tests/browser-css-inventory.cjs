const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3347';
const candidates = '.product-preview,.preview-pane,.preview-header,.preview-kicker,.preview-status,.preview-amount,.preview-payment-grid,.mock-qr,.preview-address,.preview-actions,.preview-confirmations,.preview-progress,.preview-event-log,.checkout-flow';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.addCookies([{ name: 'xmrcheckout_api_key', value: 'fixture-key', url: base }]);
    const page = await context.newPage();
    const id = '00000000-0000-4000-8000-000000000456';
    const paths = ['/', '/invoice', '/faq', '/docs', '/docs/integrations', '/guides', '/guides/self-hosted-monero-checkout', '/guides/monero-payment-api-webhooks', '/guides/monero-payment-buttons', '/guides/in-person-monero-checkout', '/tour', '/tour?tab=payment-links', '/tour?tab=terminals', '/tour?tab=invoice', '/tour?tab=webhooks', '/dashboard?tab=invoices', '/dashboard?tab=profile', '/dashboard?tab=payment-links', '/dashboard?tab=terminals', '/pay/fixture-token', '/invoice/' + id, '/i/' + id, '/i/' + id + '/receipt'];
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of paths) {
        await page.goto(base + path, { waitUntil: 'networkidle' });
        await page.locator('main details').evaluateAll(details => details.forEach(detail => detail.open = true));
        assert.equal(await page.locator(candidates).count(), 0, 'No retired illustration classes in ' + path);
      }
      console.log('Unused illustration inventory passed:', width);
    }
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
