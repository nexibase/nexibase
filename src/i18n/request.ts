import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'
import { prisma } from '@/lib/prisma'

/**
 * Reads the site_locale setting directly from DB.
 * Caching is intentionally avoided — under Turbopack HMR / module splitting,
 * module-level caches can get pinned in a stale state. Because this is an
 * indexed unique lookup on `key`, per-request querying is cheap.
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
    // DB error — fall back to the default locale
  }
  return routing.defaultLocale
}

/**
 * @deprecated Kept for compatibility. Currently a no-op.
 * Callers (install API) relied on the old cache invalidation hook; we no longer
 * cache, but we leave the export so those call sites don't break.
 */
export function setCachedLocale(_locale: string) {
  // no-op
}

export default getRequestConfig(async () => {
  // Nexibase is a single-language site — DB site_locale is authoritative.
  // The browser Accept-Language header and URL locale hints are ignored.
  // (The install Step 2 page does not use next-intl and ships its own LABELS,
  //  so no special-casing is required here.)
  const locale = await getSiteLocale()
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
