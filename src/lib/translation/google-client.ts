import { v3 } from '@google-cloud/translate'
import { prisma } from '@/lib/prisma'

interface CachedClient {
  client: v3.TranslationServiceClient
  parent: string
  hash: string
}

let cached: CachedClient | null = null

const PROJECT_ID_KEY = 'google_translate_project_id'
const CREDENTIALS_KEY = 'google_translate_credentials_json'

export const TRANSLATION_SETTING_KEYS = [PROJECT_ID_KEY, CREDENTIALS_KEY] as const
export const MASKED_CREDENTIALS_VALUE = '••••••••••••••••••••'

export function isMaskedCredentialsValue(value: string): boolean {
  return value === MASKED_CREDENTIALS_VALUE || value.startsWith('••••')
}

/**
 * DB에 저장된 Google Translate 설정을 읽어 클라이언트를 반환.
 * 설정이 비어있거나 JSON 파싱 실패 시 null.
 * 설정이 바뀌면 자동 재생성 (hash 기반 캐시 무효화).
 */
export async function getGoogleTranslateClient(): Promise<{ client: v3.TranslationServiceClient; parent: string } | null> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [PROJECT_ID_KEY, CREDENTIALS_KEY] } },
  })
  const projectIdRow = rows.find(r => r.key === PROJECT_ID_KEY)
  const credRow = rows.find(r => r.key === CREDENTIALS_KEY)

  const projectId = projectIdRow?.value?.trim()
  const credentialsJson = credRow?.value?.trim()

  if (!projectId || !credentialsJson) return null

  const hash = `${projectId}|${credRow?.updatedAt.getTime() ?? 0}|${credentialsJson.length}`
  if (cached?.hash === hash) {
    return { client: cached.client, parent: cached.parent }
  }

  try {
    const credentials = JSON.parse(credentialsJson)
    const client = new v3.TranslationServiceClient({ credentials, projectId })
    const parent = `projects/${projectId}/locations/global`
    cached = { client, parent, hash }
    return { client, parent }
  } catch (err) {
    console.error('[translation] Google client init failed:', err)
    cached = null
    return null
  }
}

/**
 * 번역 기능 사용 가능 여부. DB 설정 존재 여부만 확인.
 */
export async function isTranslationEnabled(): Promise<boolean> {
  const count = await prisma.setting.count({
    where: {
      key: { in: [PROJECT_ID_KEY, CREDENTIALS_KEY] },
      NOT: { value: '' },
    },
  })
  return count === 2
}

/**
 * 설정이 변경된 후 외부에서 캐시를 강제로 리셋할 때 사용.
 */
export function resetTranslateClientCache(): void {
  cached = null
}
