import { ComponentType } from 'react'

// 테마 설정 (향후 DB나 환경변수에서 가져올 수 있음)
const CURRENT_THEME = process.env.NEXT_PUBLIC_THEME || 'default'

type ThemeComponent = 'HomePage' | 'LoginPage' | 'SignupPage' | 'BoardPage' | 'PostPage'

// 테마 컴포넌트 동적 로더
export async function loadThemeComponent<P = Record<string, unknown>>(
  componentName: ThemeComponent
): Promise<ComponentType<P>> {
  // custom 테마 먼저 시도, 없으면 default 사용
  try {
    if (CURRENT_THEME === 'custom') {
      const customModule = await import(`@/themes/custom/${componentName}`)
      return customModule.default as ComponentType<P>
    }
  } catch {
    // custom 테마에 해당 컴포넌트가 없으면 default 사용
  }

  // default 테마 로드
  const defaultModule = await import(`@/themes/default/${componentName}`)
  return defaultModule.default as ComponentType<P>
}

// 테마 이름 가져오기
export function getThemeName(): string {
  return CURRENT_THEME
}

// 사용 가능한 테마 목록
export function getAvailableThemes(): string[] {
  return ['default', 'custom']
}
