'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ConsentAction, ConsentChoices, ConsentClientState } from '@/lib/consent/types'
import { ConsentBanner } from './ConsentBanner'
import { ConsentPreferences } from './ConsentPreferences'
import { ConsentToast } from './ConsentToast'

export type ConsentStrings = {
  title: string
  description: string
  toastSaved: string
  statusAccepted: string
  statusRejected: string
  acceptAll: string
  rejectAll: string
  settings: string
  save: string
  close: string
  privacyLink: string
  reopen: string
  error: string
  necessaryTitle: string
  necessaryDescription: string
  analyticsTitle: string
  analyticsDescription: string
  alwaysOn: string
}

type ConsentContextValue = {
  state: ConsentClientState
  submitting: boolean
  error: boolean
  strings: ConsentStrings
  privacyHref: string
  preferencesOpen: boolean
  openPreferences: () => void
  closePreferences: () => void
  submit: (action: ConsentAction, choices: ConsentChoices) => Promise<void>
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) throw new Error('useConsent must be used within ConsentProvider')
  return ctx
}

/**
 * 같은 페이지 세션에서 다시 동의했을 때, 이미 로드된 gtag에 허용을 알린다.
 *
 * `next/script`는 모듈 레벨 `LoadCache`를 스크립트 `id`로 유지한다. 그래서
 * 언마운트 후 다시 마운트된 `<Script id="ga-consent-init">`는 두 번 다시
 * 실행되지 않는다. `update: granted`를 담은 인라인 스크립트가 거기에만 있으므로
 * 리마운트에 기대면 철회 → 재동의 시 쿠키와 감사 로그는 granted인데 GA만
 * denied로 남아 새로고침 전까지 수집이 죽는다.
 *
 * gtag가 이미 있으면 여기서 직접 밀어 넣는다. 아직 없으면 `GatedAnalytics`가
 * 처음 주입될 때 인라인 스크립트가 실행되므로 아무것도 하지 않는 것이 맞다.
 */
function grantAnalyticsClientSide() {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void }
  w.gtag?.('consent', 'update', { analytics_storage: 'granted' })
}

/** 이미 로드된 gtag에 철회를 알리고 GA 쿠키를 지운다. */
function revokeAnalyticsClientSide() {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void }
  w.gtag?.('consent', 'update', { analytics_storage: 'denied' })

  // _ga, _ga_XXXX, _gid 제거. 도메인 변형까지 훑는다.
  // 정규식은 _ga / _ga_로 시작하는 것과 정확히 _gid만 잡는다.
  // `^_ga|^_gid$` 처럼 쓰면 교차가 잘못 묶여 _gadget 같은 이름까지 지운다.
  const GA_COOKIE = /^_ga($|_)|^_gid$/
  const host = window.location.hostname
  // 등록 가능 도메인(registrable domain)을 정확히 구하려면 public suffix list가
  // 필요하다. 대신 host 자신과, 호스트명 레이블을 앞에서부터 하나씩 줄여나간
  // 모든 dotted 접미사(마지막 두 레이블까지)를 전부 시도한다 — 예:
  // sub.example.co.uk → .sub.example.co.uk, .example.co.uk, .co.uk.
  // 브라우저는 현재 호스트에 허용되지 않는 Domain 값(예: public suffix인
  // .co.uk)은 조용히 무시하므로 과도하게 시도해도 안전하다. 반대로
  // 등록 가능 도메인을 잘못 추측해 너무 짧게 자르면(예: 옛 코드의
  // 마지막 두 레이블 고정 방식) 쿠키가 지워지지 않고 남는다.
  // IP 주소나 점이 없는 호스트(localhost 등)는 Domain 지정이 의미 없으므로
  // dotted 변형 자체를 만들지 않는다.
  const isIpAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')
  const labels = host.split('.')
  const domains = [host]
  if (!isIpAddress && labels.length > 1) {
    for (let i = 0; i < labels.length - 1; i++) {
      domains.push(`.${labels.slice(i).join('.')}`)
    }
  }
  for (const raw of document.cookie.split(';')) {
    const name = raw.split('=')[0]?.trim()
    if (!name || !GA_COOKIE.test(name)) continue
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`
    }
    document.cookie = `${name}=; Max-Age=0; path=/`
  }
}

/**
 * `initialState`는 `ConsentClientState`다 — `consentId`가 없다.
 *
 * 클라이언트 컴포넌트의 props는 SSR HTML 안의 flight 페이로드로 직렬화되므로,
 * 여기에 `consentId`를 실으면 `HttpOnly` 쿠키에 감춰 둔 익명 UUID가 페이지
 * 소스에서 그대로 읽힌다. 클라이언트는 이 값을 쓸 일이 없고, 서버는 쿠키에서
 * 직접 읽는다. 다시 넣지 말 것.
 */
export function ConsentProvider({
  initialState,
  strings,
  privacyHref,
  children,
}: {
  initialState: ConsentClientState
  strings: ConsentStrings
  privacyHref: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [state, setState] = useState<ConsentClientState>(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  // 저장 직후 잠깐 뜨는 확인 토스트. null이면 표시하지 않는다.
  const [toastAnalytics, setToastAnalytics] = useState<boolean | null>(null)
  const dismissToast = useCallback(() => setToastAnalytics(null), [])

  const submit = useCallback(
    async (action: ConsentAction, choices: ConsentChoices) => {
      setSubmitting(true)
      setError(false)
      try {
        const res = await fetch('/api/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...choices }),
        })
        if (!res.ok) throw new Error(`consent request failed: ${res.status}`)

        const wasAnalytics = state.analytics
        setState({
          decided: true,
          analytics: choices.analytics,
          marketing: choices.marketing,
          decidedAt: Date.now(),
        })
        setPreferencesOpen(false)
        setToastAnalytics(choices.analytics)

        if (wasAnalytics && !choices.analytics) {
          revokeAnalyticsClientSide()
          // 주의: 이미 삽입된 <script> 태그는 사라지지 않는다. next/script는
          // 언마운트 정리를 하지 않으므로 GatedAnalytics가 null을 반환해도
          // 태그 요소는 전체 페이지 로드 전까지 DOM에 남는다. 철회를 실제로
          // 담보하는 것은 위의 Consent Mode denied 전송과 GA 쿠키 삭제다.
          // router.refresh()는 서버가 다시 판정한 상태(배너·게이팅)를 받기 위한 것.
          router.refresh()
        } else if (!wasAnalytics && choices.analytics) {
          // 같은 페이지 세션에서의 재동의. next/script의 LoadCache 때문에
          // GatedAnalytics가 다시 마운트되어도 인라인 스크립트가 재실행되지
          // 않으므로, granted를 여기서 직접 밀어 넣는다.
          grantAnalyticsClientSide()
        }
      } catch (err) {
        console.error('[consent]', err)
        // 실패 시 동의를 낙관적으로 켜지 않는다 — 배너를 유지한다
        setError(true)
      } finally {
        setSubmitting(false)
      }
    },
    [router, state.analytics],
  )

  const value = useMemo<ConsentContextValue>(
    () => ({
      state,
      submitting,
      error,
      strings,
      privacyHref,
      preferencesOpen,
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
      submit,
    }),
    [state, submitting, error, strings, privacyHref, preferencesOpen, submit],
  )

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {!state.decided && <ConsentBanner />}
      <ConsentPreferences />

      {toastAnalytics !== null && (
        <ConsentToast
          title={strings.toastSaved}
          detail={toastAnalytics ? strings.statusAccepted : strings.statusRejected}
          closeLabel={strings.close}
          onDismiss={dismissToast}
        />
      )}

      {/*
        철회 진입점. 예전에는 fixed로 화면 좌하단에 상시 떠 있었는데, 모든 페이지를
        따라다녀 거슬린다는 지적을 받아 문서 흐름 맨 끝으로 내렸다.

        없애지는 않는다. GDPR 7(3)이 철회를 동의만큼 쉬울 것으로 요구하는데,
        수락은 배너에서 1클릭이므로 철회 경로가 사라지면 요건을 못 맞춘다.
        모든 페이지 하단에 있으니 접근 자체는 유지된다.

        테마의 Footer가 아니라 여기서 렌더하는 이유는 3.6절과 같다 — 푸터는
        테마 소유라 테마를 바꾸면 링크가 사라진다.
      */}
      {state.decided && (
        <div className="border-t border-border py-4 text-center">
          <button
            type="button"
            onClick={() => setPreferencesOpen(true)}
            className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {strings.reopen}
          </button>
        </div>
      )}
    </ConsentContext.Provider>
  )
}
