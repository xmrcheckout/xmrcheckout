import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { timestampMs, utcTimestamp, timeRemaining } from '../lib/timestamps.ts';
import { createTranslator } from '../lib/i18n/translate.ts';
const t = createTranslator('en', JSON.parse(readFileSync(new URL('../messages/en.json', import.meta.url), 'utf8')));

test('timestamps always identify UTC and preserve the instant across offsets and server zones', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Asia/Tokyo', 'America/New_York']) {
      process.env.TZ = zone;
      assert.equal(utcTimestamp('2026-10-31T16:25:26Z', t), '2026-10-31 16:25:26 UTC');
      assert.equal(utcTimestamp('2026-11-01T01:25:26+09:00', t), '2026-10-31 16:25:26 UTC');
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('missing, invalid, and ambiguous timestamps never fabricate a deadline', () => {
  for (const value of [null, undefined, '', 'invalid', '2026-10-31T16:25:26', '2026-99-99T16:25:26Z', '2026-02-30T16:25:26Z']) {
    assert.equal(timestampMs(value), null);
    assert.equal(utcTimestamp(value, t), value ? 'Time unavailable' : 'Not set');
  }
});

test('remaining time rounds up until the deadline and never becomes negative', () => {
  assert.equal(timeRemaining(3661000, 0, t), '1h 1m 1s remaining');
  assert.equal(timeRemaining(1, 0, t), '0h 0m 1s remaining');
  assert.equal(timeRemaining(1000, 1000, t), '0h 0m 0s remaining');
  assert.equal(timeRemaining(1000, 2000, t), '0h 0m 0s remaining');
});
