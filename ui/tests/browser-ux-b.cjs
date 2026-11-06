const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3336';
const api = process.argv[3] || 'http://127.0.0.1:8035';
const load = locale => JSON.parse(readFileSync(resolve(process.cwd(), 'messages', `${locale}.json`), 'utf8'));
const en = load('en');
const de = load('de');
const fixtureInvoice = '00000000-0000-4000-8000-000000000456';
const address = '4' + '1'.repeat(94);

async function fixture(options) {
  const response = await fetch(api + '/__fixture', { method: 'POST', body: JSON.stringify(options) });
  assert.ok(response.ok, 'fixture configuration succeeds');
}
async function savedProfile() {
  const response = await fetch(api + '/api/core/profile', { headers: { Authorization: 'ApiKey fixture-only-api-key' } });
  assert.ok(response.ok);
  return response.json();
}
async function contextFor(browser, options = {}, locale = 'en') {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  await context.addCookies([
    { name: 'xmrcheckout_api_key', value: 'fixture-only-api-key', url: base },
    { name: 'xmrcheckout_locale', value: locale, url: base },
  ]);
  return context;
}
const deliveries = [
  ['queued', 0, null],
  ['accepted', 1, 204],
  ['http-failure', 1, 503],
  ['no-response', 1, null],
].map(([name, attempt, httpStatus], index) => ({
  id: `00000000-0000-4000-8000-00000000020${index}`,
  webhook_id: '00000000-0000-4000-8000-000000000111',
  event: `invoice.fixture_${name}`,
  url: `https://fixture.invalid/${name}`,
  invoice_id: fixtureInvoice,
  invoice_address: address,
  invoice_subaddress_index: 1,
  invoice_amount_xmr: '0.100000000000',
  invoice_status: 'payment_detected',
  http_status: httpStatus,
  error_message: null,
  attempt,
  next_attempt_at: attempt === 0 ? '2026-11-07T12:00:00Z' : null,
  created_at: '2026-11-06T12:00:00Z',
}));
function deliveryCard(page, delivery) {
  return page.locator('div.rounded-surface').filter({ has: page.getByText(delivery.url, { exact: true }) });
}
async function fits(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    await fixture({ state: 'ready', webhookDeliveries: [], healthCompletedAt: null });
    const context = await contextFor(browser, { viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    for (const style of ['standard', 'btcpay_classic']) {
      await fixture({ profileStyle: style });
      await page.goto(base + '/dashboard?tab=profile', { waitUntil: 'networkidle' });
      const select = page.locator('select[name="btcpay_checkout_style"]');
      const form = page.locator('form').filter({ has: select });
      assert.equal(await select.inputValue(), style, 'profile displays the saved layout');
      await form.getByRole('button', { name: en.settings.savePreference, exact: true }).click();
      await form.getByText(en.dashboard.actions.preferenceSaved, { exact: true }).waitFor();
      assert.equal((await savedProfile()).btcpay_checkout_style, style, 'unchanged save preserves the stored layout');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await select.inputValue(), style, 'saved layout survives a full reload');
    }
    await fixture({ profileStyle: null });
    await page.goto(base + '/dashboard?tab=profile', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('select[name="btcpay_checkout_style"]').inputValue(), 'btcpay_classic', 'missing preference retains Classic fallback');
    console.log('PASS saved layouts, unchanged form submissions, reloads and missing-preference fallback');

    await fixture({ webhookDeliveries: deliveries });
    await page.goto(base + '/dashboard?tab=overview', { waitUntil: 'networkidle' });
    const metric = page.getByRole('link').filter({ has: page.getByText(en.dashboard.page.webhookIssues, { exact: true }) });
    assert.equal(await metric.locator('p.font-mono').innerText(), '2', 'queued deliveries do not increase webhook issue count');
    const activity = page.getByRole('region', { name: en.dashboard.page.recentDeliveries, exact: true });
    for (const [index, delivery] of deliveries.entries()) {
      const row = activity.locator(':scope > div.mt-4 > div').filter({ hasText: delivery.event });
      assert.equal(await row.count(), 1);
      const label = index === 0 ? en.webhooks.history.queued : index === 1 ? en.dashboard.page.accepted : en.dashboard.page.needsReview;
      const badge = row.locator('span').filter({ hasText: label });
      assert.equal((await badge.textContent()).trim(), label);
      if (index === 0) {
        assert.equal(await row.getByText(/Delivery failed/).count(), 0, 'queued row does not report a failure');
        assert.ok((await badge.getAttribute('class')).includes('border-stroke'), 'queued badge uses neutral appearance');
      }
    }
    await page.goto(base + '/dashboard?tab=webhooks&webhook_tab=history', { waitUntil: 'networkidle' });
    await page.getByText(en.webhooks.history.needReviewCount.replace('{count}', '2'), { exact: true }).waitFor();
    for (const [index, delivery] of deliveries.entries()) {
      const card = deliveryCard(page, delivery);
      assert.equal(await card.count(), 1);
      const label = index === 0 ? en.webhooks.history.queued : delivery.http_status === null ? en.webhooks.history.noResponse : String(delivery.http_status);
      assert.equal((await card.locator('span').filter({ hasText: label }).textContent()).trim(), label);
      assert.equal(await card.getByRole('button', { name: en.webhooks.history.redeliver, exact: true }).count(), index < 2 ? 0 : 1);
    }
    console.log('PASS queued, successful, HTTP-failure and no-response classifications agree in overview and history');
    await context.close();

    const german = await contextFor(browser, { locale: 'de-DE', viewport: { width: 390, height: 1000 } }, 'de');
    const localized = await german.newPage();
    await localized.goto(base + '/dashboard?tab=webhooks&webhook_tab=history', { waitUntil: 'networkidle' });
    const card = deliveryCard(localized, deliveries[0]);
    await card.getByText(de.webhooks.history.viewInvoiceDetails, { exact: true }).click();
    await card.getByText(de.invoiceStatus.payment_detected, { exact: true }).waitFor();
    await card.getByText('0.1 XMR', { exact: true }).waitFor();
    assert.equal(await card.getByText('payment_detected', { exact: true }).count(), 0, 'history hides raw invoice-status enum');
    assert.equal(await card.getByText('0.100000000000', { exact: true }).count(), 0, 'history trims display padding');
    await fits(localized, 'localized webhook details fit at 390px');
    console.log('PASS localized history status and exact XMR amount with unit');
    await german.close();

    for (const timezoneId of ['Asia/Tokyo', 'America/New_York']) {
      const healthContext = await contextFor(browser, { timezoneId, locale: 'en-GB', viewport: { width: 390, height: 1000 } });
      const healthPage = await healthContext.newPage();
      for (const [healthCompletedAt, expected] of [
        ['2026-11-01T01:25:26+09:00', '2026-10-31 16:25:26 UTC'],
        [null, en.time.notRecorded],
        ['invalid', en.time.unavailable],
      ]) {
        await fixture({ healthCompletedAt });
        await healthPage.goto(base + '/dashboard?tab=health', { waitUntil: 'networkidle' });
        const lastCheck = healthPage.locator('dl > div').filter({ has: healthPage.getByText(en.health.lastCheck, { exact: true }) });
        assert.equal(await lastCheck.locator('dd').innerText(), expected, `health completion timestamp in ${timezoneId}`);
        await fits(healthPage, 'health timestamps fit at 390px');
      }
      await healthContext.close();
    }
    console.log('PASS health UTC timestamps across browser zones, missing and invalid timestamps');
  } finally {
    await fixture({ profileStyle: null, webhookDeliveries: [], healthCompletedAt: null });
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
