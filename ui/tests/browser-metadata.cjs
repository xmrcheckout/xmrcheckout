const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3347';
const origin = process.argv[3] || 'https://checkout.example';
const id = '00000000-0000-4000-8000-000000000456';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const path of ['/', '/invoice', '/faq', '/tour', '/docs', '/docs/integrations', '/guides', '/guides/self-hosted-monero-checkout', '/guides/monero-payment-api-webhooks', '/guides/monero-payment-buttons', '/guides/in-person-monero-checkout', '/donate']) {
      const response = await page.goto(base + path, { waitUntil: 'networkidle' });
      if (path === '/donate' && response.status() === 404) continue;
      assert.equal(response.status(), 200, path);
      const title = await page.title();
      assert.ok(title.endsWith(' | XMR Checkout'), path + ' site title');
      assert.equal(title.split('XMR Checkout').length, 2, path + ' one site suffix');
      assert.equal(new URL(await page.locator('link[rel=canonical]').getAttribute('href')).href, new URL(path, origin).href);
      assert.equal(new URL(await page.locator('meta[property="og:url"]').getAttribute('content')).href, new URL(path, origin).href);
      assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), title);
      assert.equal(await page.locator('meta[name="twitter:title"]').getAttribute('content'), title);
      assert.equal(await page.locator('meta[property="og:description"]').getAttribute('content'), await page.locator('meta[name=description]').getAttribute('content'));
      assert.equal(await page.locator('meta[name=robots][content*=noindex]').count(), 0, path + ' stays indexable');
    }
    await context.addCookies([{ name: 'xmrcheckout_api_key', value: 'fixture-key', url: base }]);
    for (const path of ['/dashboard?tab=payment-links', '/dashboard?tab=terminals', '/dashboard?tab=profile', '/i/' + id, '/i/' + id + '/receipt', '/invoice/' + id, '/pay/fixture-token', '/i/bad-id', '/i/bad-id/receipt', '/invoice/bad-id', '/pay/dead-token', '/invoice-link-unavailable', '/payment-link-unavailable', '/i-link-unavailable']) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      assert.ok(await page.locator('meta[name=robots][content*=noindex]').count(), path + ' noindex');
      assert.equal((await page.title()).includes(id), false, 'No identifier in metadata title');
    }
    const sitemap = await (await context.request.get(base + '/sitemap.xml')).text();
    assert.ok(sitemap.includes('<loc>' + origin + '/tour</loc>'));
    assert.ok(!sitemap.includes('/i/'));
    const robots = await (await context.request.get(base + '/robots.txt')).text();
    assert.ok(robots.includes('Disallow: /i/'));
    assert.ok(robots.includes('Sitemap: ' + origin + '/sitemap.xml'));
    console.log('Public titles, descriptions, canonical URLs, private noindex, sitemap and crawler exclusions passed.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
