import test from 'node:test';
import assert from 'node:assert/strict';
import { PAYMENT_PROOF_LIMITS, paymentProofSummary } from '../lib/payment-proof.ts';

const outcome = (overrides = {}) => ({
  result: 'credited',
  proof_type: 'tx_key',
  received_xmr: '1.5',
  required_xmr: '2',
  in_pool: false,
  confirmations: 1,
  confirmation_target: 3,
  bound_to_invoice: false,
  checked_at: '2026-11-01T00:00:00Z',
  ...overrides,
});

test('matching results show the amount, confirmations, and what is required', () => {
  for (const result of ['credited', 'other_invoice', 'predates_invoice', 'not_recorded']) {
    const summary = paymentProofSummary(outcome({ result }));
    assert.equal(summary.matched, true);
    assert.match(summary.evidence[0], /1\.5 XMR was sent to this invoice's address/);
    assert.match(summary.evidence[0], /1 confirmation\./);
    assert.match(summary.evidence[1], /asks for 2 XMR with 3 confirmations/);
  }
});

test('results that do not match never claim funds were sent', () => {
  for (const result of ['no_match', 'not_found']) {
    const summary = paymentProofSummary(outcome({ result, received_xmr: '0' }));
    assert.equal(summary.matched, false);
    assert.deepEqual(summary.evidence, []);
  }
});

test('pool transactions are described as unconfirmed', () => {
  const [line] = paymentProofSummary(outcome({ in_pool: true, confirmations: 0 })).evidence;
  assert.match(line, /still in the transaction pool with 0 confirmations/);
});

test('binding wording distinguishes keys, unbound signatures, and bound signatures', () => {
  const line = (overrides) => paymentProofSummary(outcome(overrides)).evidence[2];
  assert.match(line({}), /cannot be tied to a specific invoice/);
  assert.match(line({ proof_type: 'signature' }), /not made specifically for this invoice/);
  assert.match(line({ proof_type: 'signature', bound_to_invoice: true }), /made for this invoice/);
});

test('wording avoids guarantees and restricted terms', () => {
  const results = ['credited', 'other_invoice', 'predates_invoice', 'not_recorded', 'no_match', 'not_found'];
  const text = [
    PAYMENT_PROOF_LIMITS,
    ...results.flatMap((result) => {
      const summary = paymentProofSummary(outcome({ result }));
      return [summary.title, summary.detail, ...summary.evidence];
    }),
  ].join(' ');
  assert.doesNotMatch(text, /settle|payout|processor|balance|guarantee|verified/i);
  assert.match(PAYMENT_PROOF_LIMITS, /does not change the invoice/);
  assert.match(PAYMENT_PROOF_LIMITS, /still spendable/);
  assert.match(PAYMENT_PROOF_LIMITS, /configured Monero daemon/);
});
