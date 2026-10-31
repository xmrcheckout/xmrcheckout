const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3336';

const labels = ['Customer', 'Your wallet', 'XMR', 'Watches,', 'can’t spend', 'XMR Checkout', 'Your store', 'Optional'];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    const reduced = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await reduced.newPage();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no page overflow at ${width}`);

      const card = page.getByRole('region', { name: 'How a payment reaches your wallet' });
      assert.equal(await card.locator('a, button, input, select, textarea, [tabindex]').count(), 0, 'the card has no controls');
      const art = card.getByRole('img');
      assert.equal(await art.count(), 1, 'one diagram');
      assert.match(await art.locator('title').textContent(), /pays your wallet directly/);
      assert.deepEqual(await art.locator('text').allTextContents(), labels);
      assert.match(await card.locator('.journey-caption').innerText(), /does not override wallet unlock rules/);

      const smallest = await art.evaluate((svg) => {
        const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
        return Math.min(...[...svg.querySelectorAll('text')].map((text) => parseFloat(getComputedStyle(text).fontSize) * scale));
      });
      assert.ok(smallest >= 11, `labels are at least 11px at ${width}: ${smallest}`);

      const cardBox = await card.boundingBox();
      if (width <= 390) assert.ok(cardBox.height <= 844, `card fits a phone screen at ${width}: ${cardBox.height}`);
      if (width >= 768) {
        const copy = await page.locator('.home-hero-copy').boundingBox();
        assert.ok(copy.width >= 240, `hero copy keeps its width at ${width}: ${copy.width}`);
        assert.ok(Math.abs(cardBox.y - copy.y) <= 8, `card aligns with the hero copy at ${width}`);
      }
      assert.equal(await card.locator('.journey-coin').evaluate((el) => getComputedStyle(el).animationName), 'none', 'no coin animation with reduced motion');
    }
    await reduced.close();

    const motion = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });
    const animated = await motion.newPage();
    await animated.goto(base + '/', { waitUntil: 'networkidle' });
    const coin = animated.locator('.journey-coin');
    assert.equal(await coin.evaluate((el) => getComputedStyle(el).animationName), 'journey-coin');
    await coin.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
    assert.equal(await coin.evaluate((el) => getComputedStyle(el).transform), 'none', 'coin rests at its drawn position');
    await motion.close();
    console.log('invoice journey checks passed');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
