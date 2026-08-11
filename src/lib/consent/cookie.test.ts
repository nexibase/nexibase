import { test } from 'node:test'
import assert from 'node:assert/strict'
import { serializeConsent, parseConsentCookie } from './cookie'
import type { StoredConsent } from './types'

const sample: StoredConsent = {
  v: 1,
  id: '11111111-2222-3333-4444-555555555555',
  analytics: true,
  marketing: false,
  ts: 1754870400000,
  pv: '1.0',
}

test('직렬화 후 파싱하면 원본과 같다', () => {
  assert.deepEqual(parseConsentCookie(serializeConsent(sample)), sample)
})

test('직렬화 결과에 쿠키를 깨뜨리는 문자가 없다', () => {
  const encoded = serializeConsent(sample)
  assert.equal(encoded.includes(';'), false)
  assert.equal(encoded.includes(','), false)
  assert.equal(encoded.includes(' '), false)
})

test('빈 값은 null', () => {
  assert.equal(parseConsentCookie(undefined), null)
  assert.equal(parseConsentCookie(null), null)
  assert.equal(parseConsentCookie(''), null)
})

test('JSON이 아니면 throw하지 않고 null', () => {
  assert.equal(parseConsentCookie('not-json'), null)
  assert.equal(parseConsentCookie('%7Bbroken'), null)
})

test('JSON 배열/원시값은 null', () => {
  assert.equal(parseConsentCookie(encodeURIComponent('[1,2]')), null)
  assert.equal(parseConsentCookie(encodeURIComponent('"str"')), null)
  assert.equal(parseConsentCookie(encodeURIComponent('null')), null)
})

test('필수 필드가 없거나 타입이 다르면 null', () => {
  const bad = [
    { ...sample, v: '1' },
    { ...sample, id: '' },
    { ...sample, analytics: 'yes' },
    { ...sample, ts: Number.NaN },
  ]
  for (const b of bad) {
    assert.equal(parseConsentCookie(encodeURIComponent(JSON.stringify(b))), null)
  }
})

test('marketing 누락은 false로 채운다', () => {
  const { marketing: _omit, ...rest } = sample
  const parsed = parseConsentCookie(encodeURIComponent(JSON.stringify(rest)))
  assert.equal(parsed?.marketing, false)
})

test('pv 누락은 null로 채운다', () => {
  const { pv: _omit, ...rest } = sample
  const parsed = parseConsentCookie(encodeURIComponent(JSON.stringify(rest)))
  assert.equal(parsed?.pv, null)
})
