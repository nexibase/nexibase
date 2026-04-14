import { routing } from '@/i18n/routing'

interface TranslationRow {
  locale: string
  [field: string]: unknown
}

interface EntityWithTranslations {
  translations?: TranslationRow[]
}

/**
 * 엔티티의 특정 필드를 locale에 맞게 해석.
 * 1. locale === defaultLocale이면 원본 필드 즉시 반환
 * 2. translations 배열에서 locale 일치 row를 찾아 해당 필드 반환
 * 3. 없으면 원본 필드로 fallback
 */
export function resolveTranslation<
  T extends EntityWithTranslations & Record<string, unknown>
>(
  entity: T,
  locale: string,
  field: keyof T & string
): string | null {
  const baseValue = entity[field]
  const baseStr = typeof baseValue === 'string' ? baseValue : baseValue == null ? null : String(baseValue)

  if (locale === routing.defaultLocale) return baseStr

  const t = entity.translations?.find(row => row.locale === locale)
  if (t && typeof t[field] === 'string' && t[field]) {
    return t[field] as string
  }
  return baseStr
}

/**
 * 엔티티 객체를 locale에 맞게 평탄화 — translations 배열을 제거하고
 * 지정된 필드들을 번역된 값으로 덮어쓴 새 객체 반환.
 */
export function flattenTranslation<
  T extends EntityWithTranslations & Record<string, unknown>
>(
  entity: T,
  locale: string,
  fields: (keyof T & string)[]
): Omit<T, 'translations'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { translations, ...rest } = entity
  const result: Record<string, unknown> = { ...rest }
  for (const f of fields) {
    result[f] = resolveTranslation(entity, locale, f)
  }
  return result as Omit<T, 'translations'>
}

/**
 * 엔티티 배열을 평탄화.
 */
export function flattenTranslations<
  T extends EntityWithTranslations & Record<string, unknown>
>(
  entities: T[],
  locale: string,
  fields: (keyof T & string)[]
): Omit<T, 'translations'>[] {
  return entities.map(e => flattenTranslation(e, locale, fields))
}

/**
 * Next.js API route에서 locale 쿼리 파라미터 파싱.
 */
export function getLocaleFromRequest(req: Request): string {
  const url = new URL(req.url)
  const locale = url.searchParams.get('locale')
  if (locale && (routing.locales as string[]).includes(locale)) {
    return locale
  }
  return routing.defaultLocale
}
