import { CONSENT_MAX_AGE_MS } from './types'
import type {
  ConsentAction,
  ConsentChoices,
  ConsentClientState,
  ConsentSettingsStatus,
  ConsentState,
  StoredConsent,
} from './types'

/** 루트 레이아웃이 렌더할 분석 경로. */
export type AnalyticsMode = 'gated' | 'ungated' | 'none'

/**
 * 설정 판정 결과로부터 어느 분석 경로를 렌더할지 정한다.
 *
 * 순수 함수로 떼어 둔 이유는 이 결정이 이 기능의 핵심 속성이기 때문이다 —
 * 브라우저 없이 세 상태를 전부 테스트할 수 있어야 한다.
 *
 * - `'on'`  → `'gated'`   동의 전에는 gtag를 주입하지 않는다
 * - `'off'` → `'ungated'` 업그레이드 이전과 동일하게 무조건 로드한다
 * - `'unknown'` → `'none'` 어느 쪽도 렌더하지 않는다. 설정을 읽지 못했으면
 *   운영자가 껐는지 알 수 없고, `'ungated'`로 떨어뜨리면 거부한 방문자에게
 *   GA가 붙는다. 실패의 기본값은 "추적 안 함"이다(설계 문서 §5).
 */
export function decideAnalyticsMode(context: {
  status: ConsentSettingsStatus
}): AnalyticsMode {
  switch (context.status) {
    case 'on':
      return 'gated'
    case 'off':
      return 'ungated'
    case 'unknown':
      return 'none'
  }
}

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
 * 서버 상태에서 클라이언트에 내려도 되는 부분만 추린다.
 *
 * 필드를 하나씩 명시적으로 꺼낸다. `ConsentState`에 새 필드가 생기면 여기서
 * 타입 오류가 나므로, 모르는 사이에 클라이언트로 새어 나가지 않는다.
 */
export function toClientState(state: ConsentState): ConsentClientState {
  return {
    decided: state.decided,
    analytics: state.analytics,
    marketing: state.marketing,
    decidedAt: state.decidedAt,
  }
}

/**
 * 설정 다이얼로그 저장 시 기록할 action을 정한다.
 *
 * 켜져 있던 카테고리를 끄는 변경이 하나라도 있으면 withdraw다. 철회 이력이
 * 증빙에서 별도로 조회 가능해야 하기 때문에 save_custom과 구분한다.
 */
export function decideAction(
  previous: Pick<ConsentState, 'analytics' | 'marketing'>,
  next: ConsentChoices,
): ConsentAction {
  const turnedOff =
    (previous.analytics && !next.analytics) || (previous.marketing && !next.marketing)
  return turnedOff ? 'withdraw' : 'save_custom'
}
