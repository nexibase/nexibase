'use client'

import { useConsent } from './ConsentProvider'

/**
 * 동의 설정을 다시 여는 버튼. 쿠키 정책 페이지(`/policies/cookie`)에 놓인다.
 *
 * 철회 경로는 "푸터의 쿠키 정책 링크 → 이 버튼"이다. 정책 페이지는 정보 제공
 * 의무(ePrivacy 5(3), GDPR 13조)를 지고, 철회 수단(GDPR 7(3))은 별개 의무라
 * 읽을 거리만 두면 충족되지 않는다. 둘을 한 페이지에 모으는 것이 유럽 사이트들의
 * 일반적인 형태다.
 *
 * 따라서 **푸터 메뉴에서 쿠키 정책 링크를 지우면 철회 경로가 끊긴다.**
 * 개인정보처리방침 링크를 지우는 것과 같은 성격의 운영자 책임이다.
 *
 * 아직 결정 전이면 배너가 떠 있으므로 아무것도 렌더하지 않는다.
 */
export function ConsentSettingsLink({ className }: { className?: string }) {
  const { state, strings, openPreferences } = useConsent()

  if (!state.decided) return null

  return (
    <button
      type="button"
      onClick={openPreferences}
      className={
        className ??
        'text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground'
      }
    >
      {strings.reopen}
    </button>
  )
}
