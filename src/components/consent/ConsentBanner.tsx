'use client'

import { Cookie } from 'lucide-react'
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
      {/*
        눈에 띄게 만드는 세 축을 함께 쓴다.

        1. 모션 — 정지한 요소는 주변시가 잡아내지 못한다. motion-safe로 감싸
           prefers-reduced-motion 사용자에게는 움직임 없이 즉시 표시된다.
        2. 색 — 흰 배경 페이지 위의 흰 카드는 그림자와 테두리만으로 버티지
           못한다. 강조색 쿠키 아이콘으로 색을 넣는다. (상단 강조색 띠도
           썼다가 과하다는 판단으로 뺐다 — 다시 넣지 말 것.)
        3. 무게 — 제목을 16px semibold로 키운다.

        위치는 하단 그대로다. 인지율만 보면 중앙이 낫지만 본문을 덮는 것은
        압박에 해당해 GDPR 4(11)의 "자유롭게 주어진" 요건과 충돌한다.
      */}
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
          <div className="flex min-w-0 gap-3">
            <Cookie className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="text-[16px] font-semibold">{strings.title}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground sm:text-sm">
                {strings.description}{' '}
                <a href={privacyHref} className="underline underline-offset-2 hover:text-foreground">
                  {strings.privacyLink}
                </a>
              </p>
              {error && <p className="mt-2 text-[13px] text-destructive">{strings.error}</p>}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/*
              설정도 테두리를 준다. ghost로 두었더니 텍스트처럼 보여 클릭할 수 있는
              줄 모르겠다는 지적이 반복됐다.
              셋이 같은 모양이 되어도 법적 요건은 지켜진다 — 요구되는 것은 거부가
              수락만큼 눈에 띌 것이지, 설정이 그 둘보다 약할 것이 아니다.
            */}
            <Button
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={openPreferences}
            >
              {strings.settings}
            </Button>
            {/*
              거부와 수락은 반드시 동일한 variant/size를 쓴다.
              둘 다 채움(default)으로 두어 결정 쌍이 "설정"보다 도드라지게 하되,
              서로는 완전히 같게 유지한다. 한쪽만 채우면 그 선택지를 강조하는
              것이 되어 EDPB Guidelines 03/2022이 다루는 기만적 설계에 해당한다.
            */}
            <Button
              variant="default"
              size="sm"
              disabled={submitting}
              onClick={() => submit('reject_all', { analytics: false, marketing: false })}
            >
              {strings.rejectAll}
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={submitting}
              onClick={() => submit('accept_all', { analytics: true, marketing: false })}
            >
              {strings.acceptAll}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
