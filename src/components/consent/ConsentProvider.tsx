'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ConsentAction, ConsentChoices, ConsentState } from '@/lib/consent/types'
import { ConsentBanner } from './ConsentBanner'
import { ConsentPreferences } from './ConsentPreferences'

export type ConsentStrings = {
  title: string
  description: string
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
  state: ConsentState
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

/** 이미 로드된 gtag에 철회를 알리고 GA 쿠키를 지운다. */
function revokeAnalyticsClientSide() {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void }
  w.gtag?.('consent', 'update', { analytics_storage: 'denied' })

  // _ga, _ga_XXXX, _gid 제거. 도메인 변형까지 훑는다.
  // 정규식은 _ga / _ga_로 시작하는 것과 정확히 _gid만 잡는다.
  // `^_ga|^_gid$` 처럼 쓰면 교차가 잘못 묶여 _gadget 같은 이름까지 지운다.
  const GA_COOKIE = /^_ga($|_)|^_gid$/
  const host = window.location.hostname
  const domains = [host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]
  for (const raw of document.cookie.split(';')) {
    const name = raw.split('=')[0]?.trim()
    if (!name || !GA_COOKIE.test(name)) continue
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`
    }
    document.cookie = `${name}=; Max-Age=0; path=/`
  }
}

export function ConsentProvider({
  initialState,
  strings,
  privacyHref,
  children,
}: {
  initialState: ConsentState
  strings: ConsentStrings
  privacyHref: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [state, setState] = useState<ConsentState>(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)

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
          consentId: state.consentId,
          analytics: choices.analytics,
          marketing: choices.marketing,
          decidedAt: Date.now(),
        })
        setPreferencesOpen(false)

        if (wasAnalytics && !choices.analytics) {
          revokeAnalyticsClientSide()
          // 다음 렌더부터 스크립트 자체가 사라지게 한다
          router.refresh()
        }
      } catch (err) {
        console.error('[consent]', err)
        // 실패 시 동의를 낙관적으로 켜지 않는다 — 배너를 유지한다
        setError(true)
      } finally {
        setSubmitting(false)
      }
    },
    [router, state.analytics, state.consentId],
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
      {state.decided && (
        <button
          type="button"
          onClick={() => setPreferencesOpen(true)}
          className="fixed bottom-3 left-3 z-40 rounded-md border border-border bg-background/90 px-3 py-1.5 text-[13px] text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
        >
          {strings.reopen}
        </button>
      )}
    </ConsentContext.Provider>
  )
}
