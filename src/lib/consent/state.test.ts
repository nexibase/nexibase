import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateConsent, decideAction, decideAnalyticsMode } from './state'
import { CONSENT_MAX_AGE_MS } from './types'
import type { ConsentState, StoredConsent } from './types'

const NOW = 1754870400000
const ID = '11111111-2222-3333-4444-555555555555'

function stored(over: Partial<StoredConsent> = {}): StoredConsent {
  return { v: 1, id: ID, analytics: true, marketing: false, ts: NOW, pv: '1.0', ...over }
}

test('쿠키가 없으면 미결정', () => {
  const s = evaluateConsent(null, 1, NOW)
  assert.equal(s.decided, false)
  assert.equal(s.consentId, null)
  assert.equal(s.analytics, false)
})

test('유효한 쿠키는 결정 상태', () => {
  const s = evaluateConsent(stored(), 1, NOW + 1000)
  assert.equal(s.decided, true)
  assert.equal(s.consentId, ID)
  assert.equal(s.analytics, true)
  assert.equal(s.decidedAt, NOW)
})

test('배너 버전이 낮으면 미결정', () => {
  const s = evaluateConsent(stored({ v: 1 }), 2, NOW)
  assert.equal(s.decided, false)
})

test('배너 버전이 더 높으면 유효로 본다', () => {
  assert.equal(evaluateConsent(stored({ v: 3 }), 2, NOW).decided, true)
})

test('180일이 지나면 미결정', () => {
  assert.equal(evaluateConsent(stored(), 1, NOW + CONSENT_MAX_AGE_MS).decided, false)
})

test('180일 직전은 유효', () => {
  assert.equal(evaluateConsent(stored(), 1, NOW + CONSENT_MAX_AGE_MS - 1).decided, true)
})

test('180일 만료로 미결정이 되어도 consentId는 유지한다', () => {
  const s = evaluateConsent(stored(), 1, NOW + CONSENT_MAX_AGE_MS)
  assert.equal(s.decided, false)
  assert.equal(s.consentId, ID)
})

test('미래 시각의 ts는 유효로 본다 (시계 오차가 배너를 다시 띄우지 않는다)', () => {
  const s = evaluateConsent(stored({ ts: NOW + 60_000 }), 1, NOW)
  assert.equal(s.decided, true)
  assert.equal(s.analytics, true)
})

test('미결정이어도 consentId는 재사용을 위해 유지한다', () => {
  const s = evaluateConsent(stored({ v: 1 }), 5, NOW)
  assert.equal(s.decided, false)
  assert.equal(s.consentId, ID)
})

test('거부 상태도 결정으로 본다 — 180일간 배너를 다시 띄우지 않는다', () => {
  const s = evaluateConsent(stored({ analytics: false }), 1, NOW + 1000)
  assert.equal(s.decided, true)
  assert.equal(s.analytics, false)
})

function prev(over: Partial<ConsentState> = {}): ConsentState {
  return { decided: true, consentId: ID, analytics: false, marketing: false, decidedAt: NOW, ...over }
}

test('켜져 있던 분석을 끄면 withdraw', () => {
  const a = decideAction(prev({ analytics: true }), { analytics: false, marketing: false })
  assert.equal(a, 'withdraw')
})

test('켜져 있던 마케팅을 끄면 withdraw', () => {
  const a = decideAction(prev({ marketing: true }), { analytics: false, marketing: false })
  assert.equal(a, 'withdraw')
})

test('끔에서 켬은 save_custom', () => {
  const a = decideAction(prev({ analytics: false }), { analytics: true, marketing: false })
  assert.equal(a, 'save_custom')
})

test('변화 없음은 save_custom', () => {
  const a = decideAction(prev({ analytics: true }), { analytics: true, marketing: false })
  assert.equal(a, 'save_custom')
})

test('하나는 켜고 하나는 끄면 withdraw가 이긴다', () => {
  const a = decideAction(prev({ analytics: true, marketing: false }), { analytics: false, marketing: true })
  assert.equal(a, 'withdraw')
})

test('미결정 상태에서의 저장은 withdraw가 아니다', () => {
  const a = decideAction(evaluateConsent(null, 1, NOW), { analytics: false, marketing: false })
  assert.equal(a, 'save_custom')
})

test('consent_enabled가 켜져 있으면 게이팅된 GA를 렌더한다', () => {
  assert.equal(decideAnalyticsMode({ status: 'on' }), 'gated')
})

test('consent_enabled가 꺼져 있으면 업그레이드 이전과 같이 무조건 로드한다', () => {
  assert.equal(decideAnalyticsMode({ status: 'off' }), 'ungated')
})

test('설정을 읽지 못하면 어느 분석 경로도 렌더하지 않는다', () => {
  assert.equal(decideAnalyticsMode({ status: 'unknown' }), 'none')
})

test('설정을 읽지 못한 상태를 "꺼짐"으로 뭉개지 않는다 — 게이팅 없는 GA 금지', () => {
  // 이 기능의 핵심 속성이다. DB 오류가 "운영자가 껐다"로 읽히면 거부한
  // 방문자에게도 GA가 붙는다(설계 문서 §5, "실패의 기본값은 추적 안 함").
  assert.notEqual(decideAnalyticsMode({ status: 'unknown' }), 'ungated')
  assert.notEqual(decideAnalyticsMode({ status: 'unknown' }), decideAnalyticsMode({ status: 'off' }))
})

test('세 상태가 서로 다른 결과로 갈린다', () => {
  const modes = (['on', 'off', 'unknown'] as const).map((status) => decideAnalyticsMode({ status }))
  assert.deepEqual(modes, ['gated', 'ungated', 'none'])
  assert.equal(new Set(modes).size, 3)
})
