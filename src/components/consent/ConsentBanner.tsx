'use client'

import { Button } from '@/components/ui/button'
import { useConsent } from './ConsentProvider'

/**
 * 1단계 배너.
 *
 * 법적 제약이 UI에 직접 걸린다:
 * - 비modal. 콘텐츠를 가리거나 스크롤을 막지 않는다 (쿠키월 금지).
 * - 거부 버튼은 수락 버튼과 같은 층위·같은 크기·같은 variant다.
 *   "설정" 뒤에 숨기지 않는다.
 * - 모바일 본문 15px 이상.
 */
export function ConsentBanner() {
  const { strings, privacyHref, submitting, error, submit, openPreferences } = useConsent()

  return (
    <div
      role="region"
      aria-label={strings.title}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[15px] font-medium">{strings.title}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground sm:text-sm">
            {strings.description}{' '}
            <a href={privacyHref} className="underline underline-offset-2 hover:text-foreground">
              {strings.privacyLink}
            </a>
          </p>
          {error && <p className="mt-2 text-[13px] text-destructive">{strings.error}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={openPreferences}
          >
            {strings.settings}
          </Button>
          {/* 거부와 수락은 반드시 동일한 variant/size를 쓴다 */}
          <Button
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => submit('reject_all', { analytics: false, marketing: false })}
          >
            {strings.rejectAll}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => submit('accept_all', { analytics: true, marketing: false })}
          >
            {strings.acceptAll}
          </Button>
        </div>
      </div>
    </div>
  )
}
