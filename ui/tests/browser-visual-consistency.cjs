const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3347';
const paths = ['/guides/self-hosted-monero-checkout', '/guides/monero-payment-api-webhooks', '/guides/monero-payment-buttons', '/guides/in-person-monero-checkout'];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const locale of ['en', 'de', 'ru', 'pl']) {
      await context.addCookies([{ name: 'xmrcheckout_locale', value: locale, url: base }]);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of paths) {
          await page.goto(base + path, { waitUntil: 'networkidle' });
          const contents = page.locator('main nav');
          assert.equal(await contents.locator('ol').count(), 1, 'Contents use an ordered list');
          const links = contents.getByRole('link');
          const count = await links.count();
          assert.ok(count >= 4);
          for (let index = 0; index < count; index++) {
            const link = links.nth(index);
            assert.ok((await link.boundingBox()).height >= 44);
            const href = await link.getAttribute('href');
            assert.equal(await page.locator(href).count(), 1, 'Contents target exists: ' + href);
          }
          await links.first().focus();
          await page.keyboard.press('Enter');
          assert.match(page.url(), /#/);
          assert.equal(await page.locator('main h1, main h2, main h3').evaluateAll(headings => headings.some(heading => /[.。]$/.test(heading.textContent.trim()))), false, 'Headings omit sentence-ending periods');
          const language = page.getByRole('combobox').last();
          assert.ok((await language.boundingBox()).height >= 44);
          await page.evaluate(() => document.documentElement.style.fontSize = '200%');
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${locale} ${path} fits at ${width}`);
        }
        console.log('Numbered guide navigation, touch targets and enlarged text passed:', locale, width);
      }
    }
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
