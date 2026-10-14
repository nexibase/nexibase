import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createVisitor, readVisitor, signVisitor } from './feedback-identity'

test('guest identity persists only with a valid server signature', () => {
  const visitor = createVisitor('test-secret')
  const id = readVisitor(visitor.cookie, 'test-secret')
  assert.ok(id)
  assert.equal(visitor.voterKey, `guest:${id}`)
  assert.equal(readVisitor(visitor.cookie, 'another-secret'), null)
  assert.equal(readVisitor(visitor.cookie.slice(0, -1) + (visitor.cookie.endsWith('0') ? '1' : '0'), 'test-secret'), null)
  for (const value of [undefined, '', 'user:1', 'short.sig', visitor.cookie + '.extra']) assert.equal(readVisitor(value, 'test-secret'), null)
  assert.equal(signVisitor(id, 'test-secret'), visitor.cookie)
  assert.notEqual(createVisitor('test-secret').voterKey, visitor.voterKey)
})
