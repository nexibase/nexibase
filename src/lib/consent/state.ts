import { CONSENT_MAX_AGE_MS } from './types'
import type { ConsentAction, ConsentChoices, ConsentState, StoredConsent } from './types'

/**
 * 저장된 쿠키를 현재 사이트 설정과 대조해 평가한다.
 *
 * 미결정으로 떨어지는 경우에도 consentId는 유지한다. 같은 방문자가 재동의할 때
 * 새 UUID를 만들면 동의 이력이 끊기기 때문이다.
 */
export function evaluateConsent(
  stored: StoredConsent | null,
  currentBannerVersion: number,
  nowMs: number,
): ConsentState {
  const undecided: ConsentState = {
    decided: false,
    consentId: stored?.id ?? null,
    analytics: false,
    marketing: false,
    decidedAt: null,
  }

  if (!stored) return undecided
  // 배너 버전이 올라갔으면 이전 동의는 무효 — 전원 재동의
  if (stored.v < currentBannerVersion) return undecided
  // 180일 경과
  if (nowMs - stored.ts >= CONSENT_MAX_AGE_MS) return undecided

  return {
    decided: true,
    consentId: stored.id,
    analytics: stored.analytics,
    marketing: stored.marketing,
    decidedAt: stored.ts,
  }
}

/**
 * 설정 다이얼로그 저장 시 기록할 action을 정한다.
 *
 * 켜져 있던 카테고리를 끄는 변경이 하나라도 있으면 withdraw다. 철회 이력이
 * 증빙에서 별도로 조회 가능해야 하기 때문에 save_custom과 구분한다.
 */
export function decideAction(previous: ConsentState, next: ConsentChoices): ConsentAction {
  const turnedOff =
    (previous.analytics && !next.analytics) || (previous.marketing && !next.marketing)
  return turnedOff ? 'withdraw' : 'save_custom'
}
