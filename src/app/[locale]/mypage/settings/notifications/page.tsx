'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MyPageLayout } from '@/components/layout/MyPageLayout'
import { Switch } from '@/components/ui/switch'
import { Bell } from 'lucide-react'

type Pref = Record<string, unknown> & { mobilePreferences?: Record<string, Record<string, boolean>> }
const rows = [
  { type: 'post_comment', label: 'postComment', email: 'emailPostComment' },
  { type: 'comment_reply', label: 'commentReply', email: 'emailCommentReply' },
  { type: 'mention', label: 'mention', email: 'emailMention' },
  { type: 'direct_message', label: 'directMessage', email: 'emailDirectMessage' },
  { type: 'order_status', label: 'orderStatus', email: 'emailOrderStatus' },
]
export default function NotificationSettingsPage() {
  const t = useTranslations('mypage.settings.notifications')
  const [pref, setPref] = useState<Pref | null>(null)
  const [availability, setAvailability] = useState<Record<string, Record<string, boolean>>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    fetch('/api/notifications/preferences').then(async response => {
      if (!response.ok) throw new Error('load')
      const data = await response.json(); setPref(data.preference); setAvailability(data.availability || {})
    }).catch(() => setMessage(t('loadFailed')))
  }, [t])
  async function update(patch: Partial<Pref>) {
    setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/notifications/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      if (!response.ok) throw new Error('save')
      setPref((await response.json()).preference)
    } catch { setMessage(t('saveFailed')) } finally { setSaving(false) }
  }
  function mobile(type: string, channel: string, value: boolean) {
    return update({ mobilePreferences: { [type]: { [channel]: value } } })
  }
  return <MyPageLayout><div className="space-y-4">
    <h2 className="text-lg font-bold flex items-center gap-2"><Bell className="h-5 w-5" />{t('title')}</h2>
    <p className="text-sm text-muted-foreground">{t('mandatoryNote')}</p>
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    {!pref ? <p className="text-sm text-muted-foreground">...</p> : <div className="border rounded-lg overflow-x-auto"><table className="w-full text-sm text-left min-w-[540px]"><thead><tr className="border-b bg-muted"><th className="p-4">{t('event')}</th><th className="p-4">{t('inApp')}</th><th className="p-4">{t('email')}</th><th className="p-4">{t('alimtalk')}</th><th className="p-4">{t('sms')}</th></tr></thead><tbody>{rows.map(row => <tr key={row.type} className="border-b last:border-0"><td className="p-4">{t(`types.${row.label}`)}</td><td className="p-4"><span className="text-muted-foreground">{t('required')}</span></td><td className="p-4"><Switch aria-label={`${t(`types.${row.label}`)} ${t('email')}`} checked={pref[row.email] === true} disabled={saving || !availability[row.type]?.email} onCheckedChange={value => update({ [row.email]: value })} /></td>{['alimtalk','sms'].map(channel => <td className="p-4" key={channel}><Switch aria-label={`${t(`types.${row.label}`)} ${t(channel)}`} checked={pref.mobilePreferences?.[row.type]?.[channel] === true} disabled={saving || !availability[row.type]?.[channel]} onCheckedChange={value => mobile(row.type, channel, value)} /></td>)}</tr>)}</tbody></table></div>}
    <p className="text-xs text-muted-foreground">{t('channelNote')}</p>
  </div></MyPageLayout>
}
