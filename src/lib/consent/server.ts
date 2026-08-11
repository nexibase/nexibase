import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { parseConsentCookie } from './cookie'
import { evaluateConsent } from './state'
import {
  CONSENT_COOKIE_NAME,
  DEFAULT_BANNER_VERSION,
  DEFAULT_POLICY_SLUG,
  type ConsentSettingsStatus,
  type ConsentState,
} from './types'

export type ConsentServerContext = {
  /**
   * `consent_enabled` 판정 결과. `'off'`(운영자가 껐다)와 `'unknown'`(읽지
   * 못했다)은 서로 다른 분석 경로로 이어진다 — `decideAnalyticsMode()` 참고.
   */
  status: ConsentSettingsStatus
  bannerVersion: number
  policySlug: string
  /** 현재 활성 개인정보처리방침 버전. policies 플러그인이 없으면 null. */
  policyVersion: string | null
  state: ConsentState
}

/**
 * 쿠키와 사이트 설정을 읽어 동의 컨텍스트를 만든다.
 *
 * 설정 조회가 실패하면 `status='unknown'`이다. 이것을 `'off'`로 뭉개면 안 된다:
 * `'off'`는 게이팅 없는 GA 로드(`UngatedAnalytics`)를 뜻하므로, 일시적인 DB
 * 오류가 "거부"를 누른 방문자에게까지 GA를 붙이게 된다. `getMeasurementId()`는
 * 자체 try/catch를 가진 별도 쿼리라 같이 실패한다는 보장도 없다.
 *
 * `'unknown'`에서는 게이팅된 경로도 게이팅 없는 경로도 렌더하지 않는다 —
 * 실패의 기본값은 "추적 안 함"이다(설계 문서 §5).
 */
export async function readConsentContext(): Promise<ConsentServerContext> {
  let status: ConsentSettingsStatus = 'unknown'
  let bannerVersion = DEFAULT_BANNER_VERSION
  let policySlug = DEFAULT_POLICY_SLUG
  let policyVersion: string | null = null

  try {
    const rows = await prisma.setting.findMany({
      where: {
        key: { in: ['consent_enabled', 'consent_banner_version', 'consent_policy_slug'] },
      },
    })
    const map = new Map(rows.map((r) => [r.key, r.value]))

    // 운영자가 손으로 넣은 'True'나 'true '가 조용히 게이팅을 끄지 않게 한다.
    // 행 자체가 없으면(설정한 적 없음) 'off'다 — 읽기에 실패한 것이 아니다.
    const flag = (map.get('consent_enabled') ?? '').trim().toLowerCase()
    status = flag === 'true' ? 'on' : 'off'

    const parsedVersion = Number(map.get('consent_banner_version'))
    if (Number.isInteger(parsedVersion) && parsedVersion > 0) {
      bannerVersion = parsedVersion
    }

    policySlug = map.get('consent_policy_slug')?.trim() || DEFAULT_POLICY_SLUG
  } catch {
    // DB 오류 — status는 'unknown'으로 남는다. 'off'로 떨어뜨리지 않는다.
    status = 'unknown'
  }

  try {
    const policy = await prisma.policy.findFirst({
      where: { slug: policySlug, isActive: true },
      select: { version: true },
    })
    policyVersion = policy?.version ?? null
  } catch {
    // policies 플러그인이 비활성이거나 테이블이 없다 — 버전 없이 진행
  }

  const store = await cookies()
  const stored = parseConsentCookie(store.get(CONSENT_COOKIE_NAME)?.value)

  return {
    status,
    bannerVersion,
    policySlug,
    policyVersion,
    state: evaluateConsent(stored, bannerVersion, Date.now()),
  }
}
