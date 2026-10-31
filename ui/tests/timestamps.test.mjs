import test from 'node:test';
import assert from 'node:assert/strict';
import { timestampMs, utcTimestamp, timeRemaining } from '../lib/timestamps.ts';

test('timestamps always identify UTC and preserve the instant across offsets and server zones', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Asia/Tokyo', 'America/New_York']) {
      process.env.TZ = zone;
      assert.equal(utcTimestamp('2026-10-31T16:25:26Z'), '2026-10-31 16:25:26 UTC');
      assert.equal(utcTimestamp('2026-11-01T01:25:26+09:00'), '2026-10-31 16:25:26 UTC');
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('missing, invalid, and ambiguous timestamps never fabricate a deadline', () => {
  for (const value of [null, undefined, '', 'invalid', '2026-10-31T16:25:26', '2026-99-99T16:25:26Z', '2026-02-30T16:25:26Z']) {
    assert.equal(timestampMs(value), null);
    assert.equal(utcTimestamp(value), value ? 'Time unavailable' : 'Not set');
  }
});

test('remaining time rounds up until the deadline and never becomes negative', () => {
  assert.equal(timeRemaining(3661000, 0), '1h 1m 1s remaining');
  assert.equal(timeRemaining(1, 0), '0h 0m 1s remaining');
  assert.equal(timeRemaining(1000, 1000), '0h 0m 0s remaining');
  assert.equal(timeRemaining(1000, 2000), '0h 0m 0s remaining');
});
