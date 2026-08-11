'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { decideAction } from '@/lib/consent/state'
import { useConsent } from './ConsentProvider'

/**
 * 2단계 카테고리 다이얼로그. 철회 진입점이기도 하다.
 *
 * 마케팅 카테고리는 현재 게이팅할 스크립트가 없어 노출하지 않는다.
 * 저장 시 marketing은 항상 false로 보낸다.
 */
export function ConsentPreferences() {
  const {
    state,
    strings,
    submitting,
    error,
    preferencesOpen,
    closePreferences,
    submit,
  } = useConsent()

  const [analytics, setAnalytics] = useState(state.analytics)

  // 열 때마다 현재 저장된 상태로 초기화한다.
  // 미결정 상태의 초기값은 꺼짐 — 사전 선택은 유효한 동의가 아니다.
  useEffect(() => {
    if (preferencesOpen) setAnalytics(state.analytics)
  }, [preferencesOpen, state.analytics])

  const handleSave = () => {
    const choices = { analytics, marketing: false }
    submit(decideAction(state, choices), choices)
  }

  return (
    <Dialog open={preferencesOpen} onOpenChange={(open) => !open && closePreferences()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{strings.title}</DialogTitle>
          <DialogDescription className="text-[15px] sm:text-sm">
            {strings.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px] font-medium sm:text-sm">{strings.necessaryTitle}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {strings.necessaryDescription}
              </p>
            </div>
            <span className="shrink-0 pt-0.5 text-[13px] text-muted-foreground">
              {strings.alwaysOn}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px] font-medium sm:text-sm">{strings.analyticsTitle}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {strings.analyticsDescription}
              </p>
            </div>
            <Switch
              checked={analytics}
              onCheckedChange={setAnalytics}
              disabled={submitting}
              aria-label={strings.analyticsTitle}
              className="shrink-0"
            />
          </div>

          {error && <p className="text-[13px] text-destructive">{strings.error}</p>}
        </div>

        {/*
          배너와 동일한 1클릭 경로를 여기에도 둔다. 수락이 배너에서 1클릭이므로
          철회도 1클릭이어야 한다 — GDPR 7(3)의 "철회는 동의만큼 쉬울 것".
          토글을 만지고 저장하는 3단계만 제공하면 그 요건이 흔들린다.
          거부·수락·저장은 모두 같은 variant/size를 써서 시각적 우열을 만들지 않는다.
        */}
        <DialogFooter className="flex-wrap gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={closePreferences} disabled={submitting}>
            {strings.close}
          </Button>
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
          <Button variant="outline" size="sm" onClick={handleSave} disabled={submitting}>
            {strings.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
