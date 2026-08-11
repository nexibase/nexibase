'use client'

import Script from 'next/script'
import { useConsent } from './ConsentProvider'

/**
 * 분석 동의가 있을 때만 gtag를 주입한다.
 *
 * 동의가 없으면 아무것도 렌더하지 않는다 — 스크립트 태그가 DOM에 존재하지
 * 않고 googletagmanager.com으로 나가는 요청도 0건이다.
 *
 * dataLayer 명령은 gtag.js 로드 전에 큐에 쌓이고 로드 시 순서대로 처리된다.
 * 따라서 consent default → update → config를 하나의 인라인 스크립트에 넣고
 * src 스크립트를 뒤에 두면 순서가 보장된다.
 *
 * `beforeInteractive`는 쓰지 않는다 — Next.js App Router에서 루트 레이아웃
 * 밖의 중첩 클라이언트 컴포넌트에서는 지원되지 않는다.
 */
export function GatedAnalytics({ measurementId }: { measurementId: string | null }) {
  const { state } = useConsent()

  if (!measurementId) return null
  if (!state.analytics) return null

  return (
    <>
      <Script id="ga-consent-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied'
});
gtag('consent', 'update', { analytics_storage: 'granted' });
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
    </>
  )
}
