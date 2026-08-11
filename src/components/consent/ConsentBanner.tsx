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
    // 페이지 위에 떠 있는 카드로 보여야 한다. 이전에는 bg-background/95를 써서
    // 본문과 같은 색이었고, 위쪽 1px 테두리만으로 구분되다 보니 페이지의 일부처럼
    // 읽혀 동의가 필요하다는 사실 자체를 놓치는 문제가 있었다.
    // 가장자리에서 띄우고 bg-card + 그림자로 층을 분리한다.
    // 여전히 비modal이다 — 오버레이가 없고 스크롤을 막지 않는다(쿠키월 금지).
    <div
      role="region"
      aria-label={strings.title}
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-2xl sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
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
