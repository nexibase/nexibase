import { getGoogleTranslateClient } from './google-client'
import { routing } from '@/i18n/routing'

export interface TranslateOptions {
  sourceLocale?: string   // default: routing.defaultLocale ('en')
  mimeType?: 'text/plain' | 'text/html'  // default: 'text/plain'
}

/**
 * 단일 문자열을 target locale로 번역.
 * 실패 시 null 반환 (호출 측이 fallback 결정).
 */
export async function translateText(
  text: string,
  targetLocale: string,
  options: TranslateOptions = {}
): Promise<string | null> {
  if (!text || !text.trim()) return text

  const source = options.sourceLocale ?? routing.defaultLocale
  if (source === targetLocale) return text

  const gc = await getGoogleTranslateClient()
  if (!gc) return null

  try {
    const [response] = await gc.client.translateText({
      parent: gc.parent,
      contents: [text],
      mimeType: options.mimeType ?? 'text/plain',
      sourceLanguageCode: source,
      targetLanguageCode: targetLocale,
    })
    return response.translations?.[0]?.translatedText ?? null
  } catch (err) {
    console.error(`[translation] translateText(${targetLocale}) failed:`, err)
    return null
  }
}

/**
 * 여러 문자열을 한 번의 API 호출로 번역. 순서 보존.
 * 실패 시 null 배열 반환 ([null, null, ...]).
 */
export async function translateMany(
  texts: string[],
  targetLocale: string,
  options: TranslateOptions = {}
): Promise<(string | null)[]> {
  if (texts.length === 0) return []
  const source = options.sourceLocale ?? routing.defaultLocale
  if (source === targetLocale) return texts.map(t => t)

  const gc = await getGoogleTranslateClient()
  if (!gc) return texts.map(() => null)

  try {
    const [response] = await gc.client.translateText({
      parent: gc.parent,
      contents: texts,
      mimeType: options.mimeType ?? 'text/plain',
      sourceLanguageCode: source,
      targetLanguageCode: targetLocale,
    })
    return (response.translations ?? []).map(t => t.translatedText ?? null)
  } catch (err) {
    console.error(`[translation] translateMany(${targetLocale}) failed:`, err)
    return texts.map(() => null)
  }
}

/**
 * routing.locales에서 defaultLocale을 제외한 부언어 목록.
 */
export function getSubLocales(): string[] {
  return routing.locales.filter(l => l !== routing.defaultLocale) as string[]
}
