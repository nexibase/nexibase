import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'
import { prisma } from '@/lib/prisma'

let cachedLocale: string | null = null

export function setCachedLocale(locale: string) {
  cachedLocale = locale
}

async function getSiteLocale(): Promise<string> {
  if (cachedLocale) return cachedLocale
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'site_locale' },
    })
    const value = setting?.value
    if (value && hasLocale(routing.locales, value)) {
      cachedLocale = value
      return value
    }
  } catch {
    // DB 오류 — 기본 locale fallback
  }
  return routing.defaultLocale
}

export default getRequestConfig(async ({ requestLocale }) => {
  // 1. request에서 명시적 locale (install Step 2의 ?locale 쿼리 등) 우선
  const requested = await requestLocale
  if (requested && hasLocale(routing.locales, requested)) {
    return {
      locale: requested,
      messages: (await import(`../messages/${requested}.json`)).default,
    }
  }

  // 2. DB 설정 기반
  const locale = await getSiteLocale()
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
