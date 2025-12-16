/**
 * 커스텀 설정 로더
 *
 * config.json의 값이 DB 설정보다 우선 적용됩니다.
 * null 값은 무시되고 DB 값이 사용됩니다.
 */

import configJson from './config.json'

export interface CustomConfig {
  site: {
    name: string | null
    logo: string | null
    description: string | null
  }
  features: {
    shop: boolean
    community: boolean
    darkMode: boolean
  }
  header: {
    showSearch: boolean
    showCart: boolean
    showDarkModeToggle: boolean
  }
}

export const customConfig: CustomConfig = configJson as CustomConfig

/**
 * 커스텀 설정과 DB 설정을 병합
 * customConfig 값이 null이 아니면 우선 사용
 */
export function mergeConfig<T extends Record<string, unknown>>(
  dbConfig: T,
  customOverride: Partial<T>
): T {
  const result = { ...dbConfig }

  for (const key in customOverride) {
    const value = customOverride[key]
    // null이 아닌 값만 오버라이드
    if (value !== null && value !== undefined) {
      result[key] = value as T[typeof key]
    }
  }

  return result
}

/**
 * 사이트 설정 가져오기 (커스텀 우선)
 */
export function getSiteConfig(dbSettings: {
  site_name?: string
  site_logo?: string
  site_description?: string
}) {
  return {
    site_name: customConfig.site.name ?? dbSettings.site_name ?? 'NexiBase',
    site_logo: customConfig.site.logo ?? dbSettings.site_logo ?? '',
    site_description: customConfig.site.description ?? dbSettings.site_description ?? '',
  }
}

/**
 * 기능 활성화 여부 확인
 */
export function isFeatureEnabled(feature: keyof CustomConfig['features']): boolean {
  return customConfig.features[feature] ?? true
}

/**
 * 헤더 설정 가져오기
 */
export function getHeaderConfig() {
  return customConfig.header
}
