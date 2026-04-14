"use client"

import { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface LocaleFieldProps {
  label: string
  helperText?: string
  /**
   * 부언어 탭에서만 표시되는 힌트 (e.g. "비워두면 영문 원본으로 노출됩니다")
   */
  subLocaleHint?: string
  isDefaultLocale: boolean
  children: ReactNode
}

/**
 * LocaleTabs 내부에서 각 필드를 감싸는 래퍼.
 * 부언어 탭에서 "자동 번역됨 / 수정하면 수동 번역으로 승격됨" 안내를 표시.
 */
export function LocaleField({ label, helperText, subLocaleHint, isDefaultLocale, children }: LocaleFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
      {!isDefaultLocale && subLocaleHint && (
        <p className="text-xs text-muted-foreground italic">{subLocaleHint}</p>
      )}
    </div>
  )
}
