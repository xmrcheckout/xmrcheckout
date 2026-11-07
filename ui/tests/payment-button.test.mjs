import test from 'node:test';
import assert from 'node:assert/strict';
import { buttonSvg, buttonWidth, paymentButtonHtml, paymentButtonImageUrl, signXmrAmount, validButtonText } from '../lib/payment-button.ts';

test('button text allows 1–32 printable characters', () => {
  assert.equal(validButtonText('Buy with Monero'), true);
  assert.equal(validButtonText('x'.repeat(32)), true);
  assert.equal(validButtonText('x'.repeat(33)), false);
  assert.equal(validButtonText('   '), false);
  assert.equal(validButtonText(''), false);
  assert.equal(validButtonText('a\u0007b'), false);
});

test('button width grows with the text and stays within bounds', () => {
  assert.equal(buttonWidth('Hi', ''), 200);
  assert.ok(buttonWidth('Monero accepted here', 'Pay with XMR') > buttonWidth('Buy with Monero', 'xmrcheckout'));
  assert.equal(buttonWidth('W'.repeat(32), 'W'.repeat(32)), 360);
});

test('button graphic escapes both lines and follows the theme', () => {
  const dark = buttonSvg({ text: 'Donate & <Monero>', sub: '"quoted"', theme: 'dark' }, 'data:image/png;base64,AAAA');
  assert.equal(dark.includes('<Monero>'), false);
  assert.ok(dark.includes('Donate &amp; &lt;Monero&gt;'));
  assert.ok(dark.includes('&quot;quoted&quot;'));
  assert.ok(dark.includes('fill="#101217"/>'));
  const light = buttonSvg({ text: 'Monero accepted here', sub: '', theme: 'light' }, 'data:image/png;base64,AAAA');
  assert.ok(light.includes('stroke="#101217"'));
  assert.equal((light.match(/<text /g) ?? []).length, 1, 'An empty second line leaves a single line');
  const width = buttonWidth('Monero accepted here', '');
  assert.ok(light.includes(`viewBox="0 0 ${width} 80"`));
});

test('button snippet carries theme and both lines, escaped', () => {
  const options = { text: 'Donate & <Monero>', sub: 'xmrcheckout', theme: 'light' };
  const src = new URL(paymentButtonImageUrl('https://checkout.example/pay/abc', options));
  assert.equal(src.pathname, '/buttons/payment.svg');
  assert.equal(src.searchParams.get('theme'), 'light');
  assert.equal(src.searchParams.get('text'), 'Donate & <Monero>');
  assert.equal(src.searchParams.get('sub'), 'xmrcheckout');
  const html = paymentButtonHtml('https://checkout.example/pay/abc"><script>', options);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('<Monero>'), false);
  assert.ok(html.includes(`width="${buttonWidth(options.text, options.sub)}" height="80"`));
});

test('button snippet without options uses the static default graphic', () => {
  const html = paymentButtonHtml('https://checkout.example/pay/abc');
  assert.ok(html.includes('src="https://checkout.example/buttons/buy-with-monero.svg"'));
  assert.ok(html.includes('width="280" height="80"'));
});

test('signs show a price only for fixed XMR links', () => {
  assert.equal(signXmrAmount({ customer_amount: false, amount_xmr: '0.1', amount_fiat: null }), '0.1');
  assert.equal(signXmrAmount({ customer_amount: false, amount_xmr: null, amount_fiat: '25.00' }), null);
  assert.equal(signXmrAmount({ customer_amount: false, amount_xmr: '0.1', amount_fiat: '25.00' }), null);
  assert.equal(signXmrAmount({ customer_amount: true, amount_xmr: null, amount_fiat: null }), null);
});
