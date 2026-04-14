import { prisma } from '@/lib/prisma'
import { translateMany, getSubLocales } from './translate'
import { routing } from '@/i18n/routing'
import { TRANSLATION_SETTING_KEYS } from './google-client'

/**
 * 공개 API 응답에 절대 포함되면 안 되는 민감 설정 키.
 * Google Translate 서비스 계정 JSON 등.
 */
export const SENSITIVE_SETTING_KEYS: readonly string[] = [...TRANSLATION_SETTING_KEYS]

export function isSensitiveSettingKey(key: string): boolean {
  return SENSITIVE_SETTING_KEYS.includes(key)
}

/**
 * 번역 대상 setting key 화이트리스트.
 * 불린/ID 값(signup_enabled 등)은 번역 대상이 아니므로 여기 명시된 key만 번역된다.
 */
export const TRANSLATABLE_SETTING_KEYS: readonly string[] = [
  'site_name',
  'site_description',
  'footer_text',
]

export function isTranslatableSettingKey(key: string): boolean {
  return TRANSLATABLE_SETTING_KEYS.includes(key)
}

/**
 * 특정 setting key를 locale에 맞게 읽는다.
 * 1. locale === defaultLocale → 원본 Setting.value
 * 2. SettingTranslation에서 (key, locale) 조회 → 없으면 원본 fallback
 */
export async function getLocalizedSetting(
  key: string,
  locale: string
): Promise<string | null> {
  const base = await prisma.setting.findUnique({ where: { key } })
  if (!base) return null
  if (locale === routing.defaultLocale) return base.value
  if (!isTranslatableSettingKey(key)) return base.value

  const t = await prisma.settingTranslation.findUnique({
    where: { key_locale: { key, locale } },
  })
  return t?.value ?? base.value
}

/**
 * 여러 setting을 한 번에 읽어 { key: value } 객체로 반환.
 * 번역 대상 키는 locale에 맞게 해석, 나머지는 원본 그대로.
 */
export async function getLocalizedSettings(
  locale: string
): Promise<Record<string, string>> {
  const [baseSettings, translations] = await Promise.all([
    prisma.setting.findMany(),
    locale !== routing.defaultLocale
      ? prisma.settingTranslation.findMany({ where: { locale } })
      : Promise.resolve([]),
  ])

  const translationMap = new Map(translations.map(t => [t.key, t.value]))
  const result: Record<string, string> = {}
  for (const s of baseSettings) {
    if (isSensitiveSettingKey(s.key)) continue  // 공개 응답에서 제외
    if (locale !== routing.defaultLocale && isTranslatableSettingKey(s.key)) {
      result[s.key] = translationMap.get(s.key) ?? s.value
    } else {
      result[s.key] = s.value
    }
  }
  return result
}

/**
 * 관리자가 setting을 저장한 직후 호출.
 * 번역 대상 key인 경우에만 모든 부언어에 대해 자동 번역해서 SettingTranslation upsert.
 */
export async function translateSettingOnSave(
  key: string,
  englishValue: string
): Promise<void> {
  if (!isTranslatableSettingKey(key)) return
  if (!englishValue || !englishValue.trim()) return

  const subLocales = getSubLocales()

  for (const locale of subLocales) {
    try {
      // manual 레코드는 보존
      const existing = await prisma.settingTranslation.findUnique({
        where: { key_locale: { key, locale } },
      })
      if (existing?.source === 'manual') continue

      const [translated] = await translateMany([englishValue], locale)
      if (translated == null) continue  // API 실패 → 다음 locale

      await prisma.settingTranslation.upsert({
        where: { key_locale: { key, locale } },
        create: { key, locale, value: translated, source: 'auto' },
        update: { value: translated, source: 'auto' },
      })
    } catch (err) {
      console.error(`[translateSettingOnSave] ${key}/${locale} failed:`, err)
    }
  }
}

/**
 * 원본 setting 값 변경 시 source='auto' 레코드 삭제 (재번역 유도).
 */
export async function invalidateSettingTranslations(key: string): Promise<void> {
  await prisma.settingTranslation.deleteMany({
    where: { key, source: 'auto' },
  })
}
