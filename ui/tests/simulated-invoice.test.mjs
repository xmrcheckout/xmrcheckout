import test from 'node:test';
import assert from 'node:assert/strict';
import { simulatedInvoice } from '../lib/simulated-invoice.ts';
test('simulation replaces scenarios consistently for zero, one and two confirmations', () => {
  for(const target of [0,1,2]) {
    const created='2026-01-01T12:00:00Z';
    for(const status of ['pending','payment_detected','confirmed','expired','invalid']) {
      const result=simulatedInvoice(status,target,created);
      const effective=target===0 && status==='payment_detected'?'confirmed':status;
      assert.equal(result.status,effective);
      assert.equal(result.confirmations,effective==='confirmed'?target:effective==='payment_detected'?Math.max(0,target-1):0);
      assert.equal(result.timeline.some(e=>e.event==='detected'),['payment_detected','confirmed'].includes(effective));
      assert.equal(result.timeline.some(e=>e.event==='confirmed'),effective==='confirmed');
      assert.equal(result.timeline.some(e=>e.event==='expired'),effective==='expired');
      assert.deepEqual(result,simulatedInvoice(status,target,created));
    }
    assert.equal(simulatedInvoice('pending',target,created).timeline.length,1);
  }
});
