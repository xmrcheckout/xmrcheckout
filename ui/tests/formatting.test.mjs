import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFiatAmount } from '../lib/formatting.ts';

test('zero-decimal currencies show no decimals', () => {
  assert.equal(formatFiatAmount(5000, 'JPY'), '¥5,000');
  assert.equal(formatFiatAmount('12000', 'krw'), '₩12,000');
});

test('two-decimal currencies keep two decimals, including whole amounts', () => {
  assert.equal(formatFiatAmount(20, 'USD'), '$20.00');
  assert.equal(formatFiatAmount('19.5', 'EUR'), '€19.50');
});

test('unknown codes and invalid numbers fall back safely', () => {
  assert.equal(formatFiatAmount(3, 'NOTACODE'), '3.00 NOTACODE');
  assert.equal(formatFiatAmount('abc', 'USD'), '');
});
