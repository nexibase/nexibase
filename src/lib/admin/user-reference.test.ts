import assert from 'node:assert/strict'
import { test } from 'node:test'
import { userReferenceWhere } from './user-reference'

test('user references accept numeric IDs and complete UUIDs', () => {
  assert.deepEqual(userReferenceWhere('1'), { id: 1 })
  assert.deepEqual(userReferenceWhere('2147483647'), { id: 2147483647 })
  assert.deepEqual(userReferenceWhere('AE85B41C-8E22-4E2F-B5DF-272506F907A8'), {
    uuid: 'ae85b41c-8e22-4e2f-b5df-272506f907a8',
  })
})

test('invalid references cannot select a different user through parseInt prefixes', () => {
  for (const value of ['', '0', '01', '-1', '1.5', '1e3', ' 1', '1 ', '1abc',
    '2147483648', '9007199254740993', 'kagla', 'ae85b41c-8e22-4e2f-b5df-272506f907a8-extra']) {
    assert.equal(userReferenceWhere(value), null, value)
  }
})
