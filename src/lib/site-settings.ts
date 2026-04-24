import { headers } from 'next/headers'
import { prisma } from './prisma'

export interface SiteMetadataSettings {
  site_name: string
  site_description: string
  site_url: string
  keywords_array: string[]
  site_locale: string
  google_site_verification: string
  naver_site_verification: string
  bing_site_verification: string
}

const SETTING_KEYS = [
  'site_name',
  'site_description',
  'site_url',
  'site_keywords',
  'site_locale',
  'google_site_verification',
  'naver_site_verification',
  'bing_site_verification',
] as const

const FALLBACK_SETTINGS: SiteMetadataSettings = {
  site_name: 'NexiBase',
  site_description: '',
  site_url: '',
  keywords_array: [],
  site_locale: 'ko',
  google_site_verification: '',
  naver_site_verification: '',
  bing_site_verification: '',
}

export async function loadSiteSettings(): Promise<SiteMetadataSettings> {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: [...SETTING_KEYS] } },
    })
    const m = new Map(rows.map((r) => [r.key, r.value]))
    const rawKeywords = m.get('site_keywords') || ''
    return {
      site_name: (m.get('site_name') || '').trim() || 'NexiBase',
      site_description: (m.get('site_description') || '').trim(),
      site_url: (m.get('site_url') || '').trim(),
      keywords_array: rawKeywords.split(',').map((s) => s.trim()).filter(Boolean),
      site_locale: m.get('site_locale') || 'ko',
      google_site_verification: (m.get('google_site_verification') || '').trim(),
      naver_site_verification: (m.get('naver_site_verification') || '').trim(),
      bing_site_verification: (m.get('bing_site_verification') || '').trim(),
    }
  } catch {
    // DB unavailable (build-time prerender, migration in progress, misconfiguration).
    // Return safe fallbacks so metadata generation doesn't crash.
    return FALLBACK_SETTINGS
  }
}

export async function fallbackUrlFromHeaders(): Promise<string> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') || 'https'
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  return `${proto}://${host}`
}

export function mapToOgLocale(siteLocale: string): string {
  const map: Record<string, string> = {
    ko: 'ko_KR',
    en: 'en_US',
  }
  return map[siteLocale] || 'en_US'
}
