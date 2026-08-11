'use client'

import { useEffect } from 'react'
import { useConsent } from './ConsentProvider'

/**
 * 철회 진입점. 테마가 원하는 자리(보통 푸터 저작권 옆)에 놓는다.
 *
 * 마운트되면 Provider에 자신을 등록한다. 등록된 링크가 하나도 없으면 Provider가
 * 페이지 맨 아래에 예비 줄을 대신 렌더한다 — 푸터는 테마 소유라, 이 컴포넌트를
 * 쓰지 않는 테마로 바꾸는 순간 철회 경로가 통째로 사라지기 때문이다.
 * GDPR 7(3)의 "철회는 동의만큼 쉬울 것"이 테마 선택에 좌우되어서는 안 된다.
 *
 * 아직 결정 전이면 배너가 떠 있으므로 아무것도 렌더하지 않는다.
 */
export function ConsentSettingsLink({ className }: { className?: string }) {
  const { state, strings, openPreferences, registerSettingsLink } = useConsent()

  useEffect(() => registerSettingsLink(), [registerSettingsLink])

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
