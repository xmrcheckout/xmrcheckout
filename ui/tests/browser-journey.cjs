const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3336';

const expected = [
  ['Create invoice', 'Awaiting payment', '0 of 10 confirmations'],
  ['Open checkout', 'Awaiting payment', '0 of 10 confirmations'],
  ['Pay merchant', 'Awaiting payment', '0 of 10 confirmations'],
  ['Payment detected', 'Payment detected', '3 of 10 confirmations'],
  ['Target reached', 'Confirmed', '10 of 10 confirmations'],
  ['Store notified', 'Confirmed', '10 of 10 confirmations'],
];

// Controls ignore clicks until React attaches its handlers.
async function hydrated(page) {
  await page.waitForFunction(() => {
    const button = document.querySelector('.journey-steps button');
    return button && Object.keys(button).some((key) => key.startsWith('__reactProps'));
  });
}

async function visibleArt(card) {
  return card.locator('svg.journey-art').evaluateAll((svgs) => svgs.filter((svg) => getComputedStyle(svg).display !== 'none').map((svg) => svg.getAttribute('class')));
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    const reduced = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await reduced.newPage();
    for (const [width, layout] of [[320, 'narrow'], [390, 'narrow'], [768, 'narrow'], [1440, 'wide']]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await hydrated(page);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no page overflow at ${width}`);
      const card = page.locator('.invoice-journey');
      const art = await visibleArt(card);
      assert.equal(art.length, 1, `one layout visible at ${width}`);
      assert.ok(art[0].includes(`journey-art-${layout}`), `${layout} layout at ${width}`);
      assert.equal(await card.locator('.journey-hotspot').count(), 0, 'the art has no separate controls');

      const buttons = card.getByRole('group', { name: 'Invoice journey steps' }).getByRole('button');
      assert.equal(await buttons.count(), expected.length);
      const live = card.getByRole('region', { name: 'Selected step explanation' });
      const height = (await card.boundingBox()).height;
      for (const [index, [title, status, extra]] of expected.entries()) {
        await buttons.nth(index).click();
        assert.equal(await buttons.nth(index).getAttribute('aria-pressed'), 'true', `${title} is selected at ${width}`);
        assert.equal(await card.locator('.journey-scene').getAttribute('data-step'), String(index + 1));
        assert.equal(await live.getByRole('heading').innerText(), title);
        const strip = await card.locator('.journey-status').innerText();
        assert.ok(strip.toLowerCase().includes(status.toLowerCase()), `status for ${title}: ${strip}`);
        assert.ok(strip.includes('Example invoice'), 'status values stay marked as examples');
        assert.ok(strip.includes(extra), `confirmations for ${title}`);
        assert.equal((await card.boundingBox()).height, height, `height is stable on ${title} at ${width}`);
      }

      await buttons.nth(2).click();
      const coin = card.locator(`.journey-coin-${layout}`);
      assert.equal(await coin.evaluate((el) => getComputedStyle(el).animationName), 'none', 'no coin animation with reduced motion');
    }
    await reduced.close();

    const motion = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });
    const animated = await motion.newPage();
    await animated.goto(base + '/', { waitUntil: 'networkidle' });
    await hydrated(animated);
    const coin = animated.locator('.journey-coin-wide');
    assert.equal(await coin.evaluate((el) => getComputedStyle(el).animationName), 'none', 'coin rests before step 3');
    await animated.locator('.journey-steps button').nth(2).click();
    assert.equal(await coin.evaluate((el) => getComputedStyle(el).animationName), 'journey-coin-wide');
    await animated.waitForTimeout(1700);
    const moved = await coin.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    assert.equal(Math.round(moved), 138, 'coin finishes beside the wallet');
    await motion.close();
    console.log('invoice journey checks passed');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
