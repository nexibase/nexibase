import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { parseConsentCookie } from './cookie'
import { evaluateConsent } from './state'
import {
  CONSENT_COOKIE_NAME,
  DEFAULT_BANNER_VERSION,
  DEFAULT_POLICY_SLUG,
  type ConsentState,
} from './types'

export type ConsentServerContext = {
  enabled: boolean
  bannerVersion: number
  policySlug: string
  /** 현재 활성 개인정보처리방침 버전. policies 플러그인이 없으면 null. */
  policyVersion: string | null
  state: ConsentState
}

/**
 * 쿠키와 사이트 설정을 읽어 동의 컨텍스트를 만든다.
 *
 * DB 오류 시 enabled=false로 떨어진다. 이 경우 GA measurementId 조회도 같이
 * 실패하므로 결과적으로 아무것도 추적되지 않는다 — 실패의 기본값이 "추적 안 함"이다.
 */
export async function readConsentContext(): Promise<ConsentServerContext> {
  let enabled = false
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

    enabled = map.get('consent_enabled') === 'true'

    const parsedVersion = Number(map.get('consent_banner_version'))
    if (Number.isInteger(parsedVersion) && parsedVersion > 0) {
      bannerVersion = parsedVersion
    }

    policySlug = map.get('consent_policy_slug')?.trim() || DEFAULT_POLICY_SLUG
  } catch {
    // DB 오류 — 기본값(배너 비활성)을 그대로 쓴다
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
    enabled,
    bannerVersion,
    policySlug,
    policyVersion,
    state: evaluateConsent(stored, bannerVersion, Date.now()),
  }
}
