import test from 'node:test';
import assert from 'node:assert/strict';
import { badgeHtml, badgeImageUrl, signXmrAmount } from '../lib/payment-button.ts';

test('badge snippet is a static image with no account details', () => {
  assert.equal(badgeImageUrl('https://checkout.example'), 'https://checkout.example/badges/monero-accepted-here.svg');
  assert.equal(badgeImageUrl('https://checkout.example/', 'light'), 'https://checkout.example/badges/monero-accepted-here-light.svg');
  const html = badgeHtml('https://checkout.example');
  assert.match(html, /^<img src="https:\/\/checkout\.example\/badges\/monero-accepted-here\.svg" alt="Monero accepted here"/);
  assert.equal(html.includes('?'), false);
  assert.equal(html.includes('<a'), false);
});

test('badge snippet escapes the site URL', () => {
  assert.equal(badgeHtml('https://checkout.example/"><script>').includes('<script>'), false);
});

test('linked badge snippet wraps the image in the payment link', () => {
  const html = badgeHtml('https://checkout.example', 'light', 'https://checkout.example/pay/abc');
  assert.match(html, /^<a href="https:\/\/checkout\.example\/pay\/abc">\n  <img src="https:\/\/checkout\.example\/badges\/monero-accepted-here-light\.svg"/);
  assert.match(html, /<\/a>$/);
  assert.equal(badgeHtml('https://checkout.example', 'dark', 'https://x.example/"><script>').includes('<script>'), false);
});

test('signs show a price only for fixed XMR links', () => {
  assert.equal(signXmrAmount({ customer_amount: false, amount_xmr: '0.1', amount_fiat: null }), '0.1');
  assert.equal(signXmrAmount({ customer_amount: false, amount_xmr: null, amount_fiat: '25.00' }), null);
  assert.equal(signXmrAmount({ customer_amount: false, amount_xmr: '0.1', amount_fiat: '25.00' }), null);
  assert.equal(signXmrAmount({ customer_amount: true, amount_xmr: null, amount_fiat: null }), null);
});
