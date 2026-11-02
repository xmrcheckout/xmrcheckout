const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { contrast } = require('./browser-contrast.cjs');
const axePath = require.resolve('axe-core/axe.min.js');

async function main() {
  const base = process.argv[2];
  const fixture = process.argv[3] || 'http://127.0.0.1:8035';
  const configure = options => fetch(fixture + '/__fixture', { method: 'POST', body: JSON.stringify(options) });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    for (const width of [320, 390, 768, 1440]) {
      await configure({ transferMode: 'populated', transferDelay: 0 });
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
      await context.addCookies([{ name: 'xmrcheckout_api_key', value: 'fixture-only-api-key', url: base }]);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/dashboard?tab=invoices', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Details', exact: true }).locator('visible=true').first().click();
      const opener = page.getByRole('button', { name: 'View transactions', exact: true }).locator('visible=true').first();
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Recorded transactions', exact: true });
      await dialog.getByText('a'.repeat(64), { exact: true }).waitFor();
      await dialog.getByText(/0.1 XMR, 3 confirmations/).waitFor();
      assert.equal(await dialog.locator('input,textarea,form').count(), 0);
      await dialog.getByRole('button', { name: 'Copy transaction ID', exact: true }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'a'.repeat(64));
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(() => window.axe.run(document.querySelector('[role=dialog]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }).then(result => result.violations.map(item => item.id)));
      assert.deepEqual(violations, []);
      await page.evaluate(() => window.scrollTo(0, 0));
      await contrast(page);
      const close = dialog.getByRole('button', { name: 'Close', exact: true });
      const copy = dialog.getByRole('button', { name: 'Copy transaction ID', exact: true });
      await close.focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await copy.evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await close.evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Escape');
      assert.equal(await opener.evaluate(node => node === document.activeElement), true);
      for (const mode of ['empty', 'error']) {
        await configure({ transferMode: mode });
        await opener.click();
        await dialog.getByText(mode === 'empty' ? 'No transactions are recorded.' : 'Could not load recorded transactions.', { exact: true }).waitFor();
        if (mode === 'error') {
          await configure({ transferMode: 'populated', transferDelay: 700 });
          await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
          await dialog.getByText('Loading recorded transactions...').waitFor();
          await dialog.getByText('a'.repeat(64), { exact: true }).waitFor();
        }
        await page.keyboard.press('Escape');
      }
      // A result arriving after close must not appear on the next invoice.
      await configure({ transferMode: 'populated', transferDelay: 700 });
      await opener.click();
      await dialog.getByText('Loading recorded transactions...').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Details', exact: true }).locator('visible=true').first().click();
      await page.getByRole('button', { name: 'View transactions', exact: true }).locator('visible=true').last().click();
      await dialog.getByText('b'.repeat(64), { exact: true }).waitFor();
      assert.equal(await dialog.getByText('a'.repeat(64), { exact: true }).count(), 0);
      await page.addStyleTag({ content: 'html { font-size: 200%; }' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      assert.deepEqual(errors, []);
      await context.close();
    }
    const page = await browser.newPage();
    await page.goto(base + '/tour');
    assert.equal(await page.getByRole('button', { name: 'View transactions', exact: true }).count(), 0);
    console.log('Invoice transaction browser checks passed');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
