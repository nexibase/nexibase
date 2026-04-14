import { prisma } from '@/lib/prisma'
import { translateMany, getSubLocales } from './translate'

/**
 * 지원되는 엔티티 타입과 각 엔티티의 Prisma delegate·unique 키 매핑.
 * 새 엔티티 추가 시 이 객체에 항목 한 줄만 넣으면 auto-translate 지원 확장됨.
 */
interface EntitySpec {
  // Prisma translation model delegate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delegate: () => any
  // Foreign key field name (e.g. 'boardId', 'menuId')
  fkField: string
  // Fields to translate (order matters — will be passed in same order to translateMany)
  fields: readonly string[]
  // For HTML-bearing fields
  htmlFields?: readonly string[]
}

export const TRANSLATION_ENTITY_SPECS: Record<string, EntitySpec> = {
  board: {
    delegate: () => prisma.boardTranslation,
    fkField: 'boardId',
    fields: ['name', 'description'],
  },
  menu: {
    delegate: () => prisma.menuTranslation,
    fkField: 'menuId',
    fields: ['label'],
  },
  homeWidget: {
    delegate: () => prisma.homeWidgetTranslation,
    fkField: 'widgetId',
    fields: ['title'],
  },
  content: {
    delegate: () => prisma.contentTranslation,
    fkField: 'contentId',
    fields: ['title', 'content'],
    htmlFields: ['content'],
  },
  policy: {
    delegate: () => prisma.policyTranslation,
    fkField: 'policyId',
    fields: ['title', 'content'],
    htmlFields: ['content'],
  },
} as const

export type TranslatableEntityType = keyof typeof TRANSLATION_ENTITY_SPECS

export interface AutoTranslateResult {
  locale: string
  success: boolean
  error?: string
}

/**
 * 엔티티가 저장/수정된 직후 호출.
 * - 모든 부언어(en 제외)에 대해 번역 실행
 * - source='auto' 레코드만 upsert (source='manual' 은 보존)
 * - 필드 중 null/빈 문자열은 번역 건너뜀
 *
 * @param entityType 'board' | 'menu' | ...
 * @param entityId 해당 엔티티의 primary id
 * @param values { fieldName: englishText } 매핑
 * @returns 각 locale별 성공/실패 결과
 */
export async function autoTranslateEntity(
  entityType: TranslatableEntityType,
  entityId: number,
  values: Record<string, string | null>
): Promise<AutoTranslateResult[]> {
  const spec = TRANSLATION_ENTITY_SPECS[entityType]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = spec.delegate() as any
  const subLocales = getSubLocales()
  const results: AutoTranslateResult[] = []

  const fields = spec.fields.filter(f => values[f] != null && values[f] !== '')
  if (fields.length === 0) return results

  for (const locale of subLocales) {
    try {
      // 필드별 개별 호출 (html/plain mimeType 구분이 필요하므로)
      const translated: Record<string, string | null> = {}
      for (const field of fields) {
        const isHtml = spec.htmlFields?.includes(field) ?? false
        const [result] = await translateMany(
          [values[field] as string],
          locale,
          { mimeType: isHtml ? 'text/html' : 'text/plain' }
        )
        translated[field] = result
      }

      // 모두 null이면 API 실패
      if (Object.values(translated).every(v => v === null)) {
        results.push({ locale, success: false, error: 'translation API returned null for all fields' })
        continue
      }

      // 기존 row 확인 (manual이면 skip)
      const existing = await delegate.findUnique({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: { [`${spec.fkField}_locale`]: { [spec.fkField]: entityId, locale } } as any
      })
      if (existing?.source === 'manual') {
        results.push({ locale, success: true })
        continue
      }

      const data: Record<string, unknown> = {
        [spec.fkField]: entityId,
        locale,
        source: 'auto',
      }
      for (const field of fields) {
        // 번역 실패한 필드는 영문 원본으로 fallback
        data[field] = translated[field] ?? values[field]
      }

      await delegate.upsert({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: { [`${spec.fkField}_locale`]: { [spec.fkField]: entityId, locale } } as any,
        create: data,
        update: data,
      })
      results.push({ locale, success: true })
    } catch (err) {
      console.error(`[auto-translate] ${entityType}#${entityId} ${locale} failed:`, err)
      results.push({ locale, success: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return results
}

/**
 * 원본 영문 필드 수정 시 호출. source='auto' 레코드를 삭제해 재번역을 유도.
 * source='manual' 레코드는 보존.
 */
export async function invalidateAutoTranslations(
  entityType: TranslatableEntityType,
  entityId: number
): Promise<void> {
  const spec = TRANSLATION_ENTITY_SPECS[entityType]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = spec.delegate() as any
  await delegate.deleteMany({
    where: { [spec.fkField]: entityId, source: 'auto' },
  })
}
