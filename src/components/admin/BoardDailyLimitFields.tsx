'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import type { DailyLimits } from '@/features/boards/lib/daily-limits'

export default function BoardDailyLimitFields({ value, onChange }: {
  value: DailyLimits
  onChange: (limits: DailyLimits) => void
}) {
  const t = useTranslations('boards.admin')
  return <fieldset className="space-y-3">
    <legend className="text-sm font-medium">{t('dailyLimits')}</legend>
    <p className="text-xs leading-6 text-muted-foreground">{t('dailyLimitsHelp')}</p>
    <div className="grid gap-4 sm:grid-cols-2">
      {(['dailyPostLimit', 'dailyCommentLimit'] as const).map(key => <label key={key} className="grid gap-2 text-sm">
        {t(key)}
        <Input type="number" min={0} max={1000000} step={1} required value={value[key]}
          onChange={event => onChange({ ...value, [key]: Number(event.target.value) })} />
      </label>)}
    </div>
  </fieldset>
}
