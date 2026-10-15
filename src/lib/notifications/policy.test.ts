import test from 'node:test'
import assert from 'node:assert/strict'
import { canUseLiveDelivery, normalizePhone, maskRecipient, renderTemplate, mobileChannels } from './policy'
import { encrypt, decrypt } from './crypto'

test('dev requires an enabled live switch AND an exact allowlisted recipient', () => {
  const previous = process.env.NOTIFICATION_ENVIRONMENT
  process.env.NOTIFICATION_ENVIRONMENT = 'development'
  try {
    assert.equal(canUseLiveDelivery({ liveEnabled: false, testRecipients: ['010-1234-5678'] }, '01012345678', 'sms'), false)
    assert.equal(canUseLiveDelivery({ liveEnabled: true, testRecipients: ['010-1234-5678'] }, '01012345678', 'sms'), true)
    assert.equal(canUseLiveDelivery({ liveEnabled: true, testRecipients: ['x@example.invalid'] }, 'other@example.invalid', 'email'), false)
    assert.equal(canUseLiveDelivery({ liveEnabled: true, testRecipients: ['01012345678@example.invalid'] }, '01012345678', 'sms'), false)
    assert.equal(canUseLiveDelivery({ liveEnabled: true, testRecipients: [] }, '01012345678', 'alimtalk'), false)
  } finally { if (previous === undefined) delete process.env.NOTIFICATION_ENVIRONMENT; else process.env.NOTIFICATION_ENVIRONMENT = previous }
})
test('contact masking, Korean phone normalization and strict variable replacement', () => {
  assert.equal(normalizePhone('+82 10-1234-5678'), '01012345678')
  assert.equal(maskRecipient('01012345678', 'sms'), '010-****-5678')
  assert.equal(maskRecipient('member@example.invalid', 'email'), 'm***@example.invalid')
  assert.equal(renderTemplate('#{고객}님\n#{link}', { 고객: '회원', link: 'https://example.invalid/a' }), '회원님\nhttps://example.invalid/a')
  assert.throws(() => renderTemplate('#{missing}', {}), /변수 누락/)
  assert.throws(() => renderTemplate('#{toString}', {}), /변수 누락/)
  assert.deepEqual(mobileChannels('alimtalk_first', true, true), ['alimtalk'])
  assert.deepEqual(mobileChannels('alimtalk_first', true, false), ['sms'])
})
test('recipient payloads and credentials are authenticated encrypted values', () => {
  const previous = process.env.NOTIFICATION_ENCRYPTION_KEY
  process.env.NOTIFICATION_ENCRYPTION_KEY = '42'.repeat(32)
  try {
    const original = { to: 'member@example.invalid', aligoKey: 'secret', text: '본문' }
    const encoded = encrypt(original)
    assert.ok(!encoded.includes(original.to) && !encoded.includes(original.aligoKey))
    assert.deepEqual(decrypt(encoded), original)
    const parts = encoded.split('.'); parts[2] = Buffer.alloc(16).toString('base64')
    assert.throws(() => decrypt(parts.join('.')))
  } finally { if (previous === undefined) delete process.env.NOTIFICATION_ENCRYPTION_KEY; else process.env.NOTIFICATION_ENCRYPTION_KEY = previous }
})
