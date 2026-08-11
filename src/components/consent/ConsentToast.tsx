'use client'

import { useEffect } from 'react'
import { Check, X } from 'lucide-react'

/**
 * 저장 직후 무엇이 저장됐는지 몇 초간 확인시키고 사라지는 토스트.
 *
 * 상시 노출되는 "쿠키 설정" 진입점을 페이지 맨 아래로 내리면서, 선택 결과에 대한
 * 즉각적인 피드백이 없어지는 것을 이 토스트가 메운다.
 *
 * role="status" + aria-live="polite"로 스크린리더에도 전달된다. 배너가 사라질 때
 * 아무 안내가 없던 접근성 공백도 함께 메운다.
 *
 * 자동으로 닫히지만 닫기 버튼을 함께 둔다 — 자동 소멸에만 의존하면 화면 확대를
 * 쓰는 사용자가 읽는 도중 사라질 수 있다.
 */
export function ConsentToast({
  title,
  detail,
  closeLabel,
  onDismiss,
  durationMs = 5000,
}: {
  title: string
  detail: string
  closeLabel: string
  onDismiss: () => void
  durationMs?: number
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(timer)
  }, [onDismiss, durationMs])

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4"
    >
      <div className="flex max-w-md items-start gap-3 rounded-lg border border-border bg-card p-3 pr-2 text-card-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
        <Check className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-500" aria-hidden />
        <div className="min-w-0">
          <p className="text-[14px] font-medium leading-snug">{title}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{detail}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={closeLabel}
          className="ml-1 shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
