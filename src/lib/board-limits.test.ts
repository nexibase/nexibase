import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getKoreaDay, isBoardDailyLimit, parseDailyLimit } from './board-limits'

test('limits preserve zero and reject invalid, fractional or overflowing values', () => {
  for (const value of [0, '0', 1, '20', 2147483647]) assert.equal(parseDailyLimit(value), Number(value))
  for (const value of ['', ' ', null, undefined, true, -1, '-1', 1.5, '1.5', '1e3', [], {}, NaN, Infinity, 2147483648]) {
    assert.equal(parseDailyLimit(value), undefined, String(value))
  }
  assert.ok(isBoardDailyLimit(undefined)) // Omitted on partial updates.
  assert.ok(isBoardDailyLimit(0))
  assert.ok(!isBoardDailyLimit(null))
  assert.ok(!isBoardDailyLimit('1'))
})

test('Korean midnight switches days regardless of server timezone, including year boundaries', () => {
  const before = getKoreaDay(new Date('2026-12-31T14:59:59.999Z'))
  assert.equal(before.day.toISOString(), '2026-12-31T00:00:00.000Z')
  assert.equal(before.start.toISOString(), '2026-12-30T15:00:00.000Z')
  assert.equal(before.end.toISOString(), '2026-12-31T15:00:00.000Z')
  const after = getKoreaDay(before.end)
  assert.equal(after.day.toISOString(), '2027-01-01T00:00:00.000Z')
  assert.equal(after.start.getTime(), before.end.getTime())
  assert.equal(after.end.getTime() - after.start.getTime(), 86400000)
})
