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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={closePreferences} disabled={submitting}>
            {strings.close}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={submitting}>
            {strings.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
