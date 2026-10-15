"use client"

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MAX_DAILY_LIMIT } from '@/lib/board-limits'

export function BoardDailyLimits({ dailyPostLimit, dailyCommentLimit, onChange }: {
  dailyPostLimit: number
  dailyCommentLimit: number
  onChange: (key: 'dailyPostLimit' | 'dailyCommentLimit', value: number) => void
}) {
  const t = useTranslations('boards.dailyLimits')
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('boardDescription')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['dailyPostLimit', 'dailyCommentLimit'] as const).map(key => {
          const value = key === 'dailyPostLimit' ? dailyPostLimit : dailyCommentLimit
          return (
            <div className="space-y-2" key={key}>
              <Label htmlFor={key}>{t(key === 'dailyPostLimit' ? 'posts' : 'comments')}</Label>
              <Input id={key} type="number" min={0} max={MAX_DAILY_LIMIT} step={1} required
                value={Number.isNaN(value) ? '' : value}
                onChange={e => onChange(key, e.target.value === '' ? NaN : Number(e.target.value))} />
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('zeroBoardHelp')}</p>
      <p className="text-xs text-muted-foreground">{t('dayHelp')}</p>
      <Link href="/admin/settings#board-default-settings" className="inline-block text-sm text-primary underline">{t('defaultsLink')}</Link>
    </div>
  )
}
