import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'
import { prisma } from '@/lib/prisma'

/**
 * site_locale 설정을 DB에서 직접 조회.
 * 캐시는 의도적으로 사용하지 않음 — Turbopack HMR/모듈 분리 상황에서
 * 모듈 수준 캐시가 stale 상태로 고정되는 문제를 피하기 위함.
 * 인덱스된 `key` 기반 unique 조회이므로 매 요청 쿼리가 부담되지 않음.
 */
async function getSiteLocale(): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'site_locale' },
    })
    const value = setting?.value
    if (value && hasLocale(routing.locales, value)) {
      return value
    }
  } catch {
    // DB 오류 — 기본 locale fallback
  }
  return routing.defaultLocale
}

/**
 * @deprecated 호환성을 위해 유지. 현재는 아무 동작도 하지 않음.
 * 캐시를 사용하지 않으므로 호출할 필요 없지만 기존 호출부(install API)를
 * 깨지 않기 위해 no-op으로 남김.
 */
export function setCachedLocale(_locale: string) {
  // no-op
}

export default getRequestConfig(async () => {
  // Nexibase는 단일 언어 사이트 — DB의 site_locale이 authoritative.
  // 브라우저 Accept-Language 헤더나 URL locale 힌트는 무시한다.
  // (Install Step 2 페이지는 next-intl을 쓰지 않고 자체 LABELS를 사용하므로
  //  별도 분기 불필요)
  const locale = await getSiteLocale()
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
