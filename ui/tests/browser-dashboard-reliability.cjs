const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3346';
const fixture = process.argv[3] || 'http://127.0.0.1:8046';
const configure = options => fetch(fixture + '/__fixture', { method: 'POST', body: JSON.stringify(options) });
const count = async () => (await (await fetch(fixture + '/__fixture')).json()).mutationCount;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.addCookies([{ name: 'xmrcheckout_api_key', value: 'fixture-key', url: base }]);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await configure({ dashboardFailure: null, resetDashboard: true });
      await page.goto(base + '/dashboard?tab=terminals&terminal=fixture-terminal');
      await page.getByLabel('Name', { exact: true }).fill('Draft terminal');
      await page.getByLabel('Enabled', { exact: true }).uncheck();
      for (const failure of [{ status: 422 }, { status: 401 }, { status: 503 }, { disconnect: true }]) {
        await configure({ dashboardFailure: { path: '/api/core/terminals/fixture-terminal', method: 'PATCH', ...failure } });
        await page.getByRole('button', { name: 'Save terminal', exact: true }).click();
        await page.getByRole('status').filter({ hasText: failure.status === 401 ? 'sign-in has expired' : failure.status === 422 ? 'Fixture rejected' : 'Could not confirm saving' }).waitFor();
        assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Draft terminal');
        assert.equal(await page.getByLabel('Enabled', { exact: true }).isChecked(), false);
      }
      await configure({ dashboardFailure: null });
      await page.getByRole('button', { name: 'Save terminal', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Terminal saved.' }).waitFor();
      assert.match(page.url(), /tab=terminals&saved=1$/, 'saving returns to the list');
      await page.goto(base + '/dashboard?tab=terminals&terminal=fixture-terminal');
      assert.equal(await page.getByLabel('Enabled', { exact: true }).isChecked(), false);
      await page.goto(base + '/dashboard?tab=terminals');
      const creation = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^Create terminal$/ }) });
      await creation.locator('summary').click();
      await creation.getByLabel('Name', { exact: true }).fill('New draft terminal');
      await creation.getByLabel('Enabled', { exact: true }).uncheck();
      await configure({ dashboardFailure: { path: '/api/core/terminals', method: 'POST', status: 503 } });
      await creation.getByRole('button', { name: 'Create terminal', exact: true }).click();
      await creation.getByRole('status').filter({ hasText: 'Could not confirm saving' }).waitFor();
      assert.equal(await creation.getByLabel('Name', { exact: true }).inputValue(), 'New draft terminal');
      assert.equal(await creation.getByLabel('Enabled', { exact: true }).isChecked(), false);
      await configure({ dashboardFailure: null });
      await creation.getByRole('button', { name: 'Create terminal', exact: true }).click();
      await creation.getByRole('status').filter({ hasText: 'Terminal created.' }).waitFor();
      assert.equal(await creation.getByLabel('Name', { exact: true }).inputValue(), '');
      assert.equal(await creation.getByLabel('Enabled', { exact: true }).isChecked(), true);
      await creation.getByText('https://checkout.example/terminal#fixture-only', { exact: true }).waitFor();
      await page.goto(base + '/dashboard?tab=webhooks');
      await page.getByLabel('Default webhook URL', { exact: true }).fill('https://merchant.example/draft');
      await page.getByLabel('invoice.created', { exact: true }).uncheck();
      const override = page.locator('#event_url_invoice_confirmed');
      await override.fill('https://merchant.example/confirmed');
      for (const failure of [{ status: 422 }, { status: 401 }, { status: 503 }, { disconnect: true }]) {
        await configure({ dashboardFailure: { path: '/api/core/webhooks', method: 'POST', delay: 500, ...failure } });
        const before = await count();
        await page.getByRole('button', { name: 'Save webhook', exact: true }).click();
        await page.getByRole('button', { name: 'Saving…', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Saving…', exact: true }).isDisabled(), true);
        await page.getByRole('alert').filter({ hasText: failure.status === 401 ? 'sign-in has expired' : failure.status === 422 ? 'Fixture rejected' : 'Could not confirm this change' }).waitFor();
        assert.equal(await page.getByLabel('Default webhook URL', { exact: true }).inputValue(), 'https://merchant.example/draft');
        assert.equal(await page.getByLabel('invoice.created', { exact: true }).isChecked(), false);
        assert.equal(await override.inputValue(), 'https://merchant.example/confirmed');
        assert.equal(await count(), before + 1, 'A failed mutation is never repeated automatically');
      }
      await configure({ dashboardFailure: null });
      await page.getByRole('button', { name: 'Save webhook', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Webhook saved.' }).waitFor();
      assert.equal(await page.getByLabel('Default webhook URL', { exact: true }).inputValue(), '');
      assert.equal(await page.getByLabel('invoice.created', { exact: true }).isChecked(), true);
      assert.equal(await override.inputValue(), '');
      const before = await count();
      const removal = page.locator('form').filter({ has: page.locator('input[name=webhook_id][value=fixture-hook]') });
      await removal.getByRole('button', { name: 'Remove', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('alertdialog').waitFor({ state: 'detached' });
      assert.equal(await count(), before, 'Cancellation sends no mutation');
      await removal.getByRole('button', { name: 'Remove', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Remove', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Webhook removed.' }).waitFor();
      assert.equal(await count(), before + 1);
      for (const expanded of [false, true]) {
        await page.goto(base + '/dashboard?tab=invoices');
        if (expanded) await page.getByRole('button', { name: 'Details', exact: true }).filter({ visible: true }).first().click();
        await page.getByRole('button', { name: 'Archive', exact: true }).filter({ visible: true }).first().click();
        const dialog = page.getByRole('dialog');
        await configure({ dashboardFailure: { path: '/api/core/invoices/' + (expanded ? '00000000-0000-4000-8000-000000000001' : '00000000-0000-4000-8000-000000000000'), method: 'DELETE', disconnect: true } });
        await dialog.getByRole('button', { name: 'Archive invoice', exact: true }).click();
        await dialog.getByRole('alert').filter({ hasText: 'Could not confirm this change' }).waitFor();
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.locator('.invoice-workspace > [role="status"]').filter({ hasText: 'Could not confirm this change' }).waitFor();
        await configure({ dashboardFailure: null });
        await page.getByRole('button', { name: 'Archive', exact: true }).filter({ visible: true }).first().click();
        await dialog.getByRole('button', { name: 'Archive invoice', exact: true }).click();
        await dialog.waitFor({ state: 'detached' });
        await page.locator('.invoice-workspace > [role="status"]').filter({ hasText: 'Invoice archived.' }).waitFor();
      }
      console.log('Drafts, pending controls, confirmation, uncertain outcomes and archive results passed:', width);
    }
    for (const tab of ['payment-links', 'terminals']) {
      await configure({ dashboardFailure: { path: '/api/core/' + tab, method: 'GET', status: 401 } });
      await page.goto(base + '/dashboard?tab=' + tab);
      await page.waitForURL(url => url.searchParams.get('login') === '1');
      assert.equal(new URL(page.url()).searchParams.get('next'), '/dashboard?tab=' + tab);
      await configure({ dashboardFailure: { path: '/api/core/' + tab, method: 'GET', status: 503 } });
      await page.goto(base + '/dashboard?tab=' + tab);
      await page.getByRole('alert').filter({ hasText: /unavailable/i }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/dashboard');
    }
    await configure({ dashboardFailure: null });
    await page.goto(base + '/welcome');
    await page.waitForURL('**/dashboard');
    await context.clearCookies();
    await page.goto(base + '/welcome');
    await page.waitForURL('**/?login=1');
    await context.close();
  } finally { await configure({ dashboardFailure: null, resetDashboard: true }); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
