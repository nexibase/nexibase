import Script from 'next/script'

/**
 * 레거시 GA 로드 경로 — consent 기능이 꺼져 있을 때(`consent_enabled=false`)만
 * 사용한다.
 *
 * 이 컴포넌트는 이 브랜치 이전에 존재하던 무조건 로드 방식을 그대로
 * 재현한다. 의도적으로 동의 게이팅을 전혀 하지 않는다 — `useConsent()`를
 * 쓰지 않으며 `ConsentProvider` 밖(즉 provider가 마운트되지 않는 disabled
 * 상태)에서 렌더된다.
 *
 * 존재 이유: `consent_enabled=false`는 업그레이드하는 기존 사이트 전체가
 * 받는 기본값이다. 이 경로가 없으면 그 사이트들은 아무 조치도 하지 않았는데
 * GA 수집이 배포 즉시, 조용히 끊긴다 — 바로 그 사고를 막기 위해 이 파일이
 * 존재한다. 동의 기반 게이팅이 필요하면 `GatedAnalytics`를 쓸 것.
 */
export function UngatedAnalytics({ measurementId }: { measurementId: string | null }) {
  if (!measurementId) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
    </>
  )
}
