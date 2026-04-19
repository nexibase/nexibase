"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Switch } from "@/components/ui/switch"
import { Bell, Mail, Info } from "lucide-react"

type Pref = {
  postComment: boolean
  commentReply: boolean
  mention: boolean
  orderStatus: boolean
  emailPostComment: boolean
  emailCommentReply: boolean
  emailMention: boolean
  emailAdminMessage: boolean
  emailOrderStatus: boolean
}

const ROWS: { key: keyof Pref; emailKey: keyof Pref | null; labelKey: string }[] = [
  { key: 'postComment',  emailKey: 'emailPostComment',  labelKey: 'postComment' },
  { key: 'commentReply', emailKey: 'emailCommentReply', labelKey: 'commentReply' },
  { key: 'mention',      emailKey: 'emailMention',      labelKey: 'mention' },
  { key: 'orderStatus',  emailKey: 'emailOrderStatus',  labelKey: 'orderStatus' },
]

export default function NotificationSettingsPage() {
  const t = useTranslations('mypage.settings.notifications')
  const [pref, setPref] = useState<Pref | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(d => setPref(d.preference))
      .catch(() => setPref(null))
  }, [])

  async function update(patch: Partial<Pref>) {
    if (!pref) return
    const next = { ...pref, ...patch }
    setPref(next)
    setSaving(true)
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <MyPageLayout>
      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t('title')}
        </h2>

        {!pref ? (
          <div className="text-sm text-muted-foreground">...</div>
        ) : (
          <div className="border rounded-lg divide-y">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-xs text-muted-foreground">
              <span />
              <span className="flex items-center gap-1"><Bell className="h-3 w-3" />{t('inApp')}</span>
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{t('email')}</span>
            </div>
            {ROWS.map(row => (
              <div key={row.key} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 items-center">
                <span className="text-sm">{t(`types.${row.labelKey}`)}</span>
                <Switch
                  checked={pref[row.key] as boolean}
                  onCheckedChange={v => update({ [row.key]: v } as Partial<Pref>)}
                />
                {row.emailKey ? (
                  <Switch
                    checked={pref[row.emailKey] as boolean}
                    onCheckedChange={v => update({ [row.emailKey!]: v } as Partial<Pref>)}
                  />
                ) : <span />}
              </div>
            ))}

            {/* Admin message row — in-app forced ON, only email toggles */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 items-center">
              <span className="text-sm flex items-center gap-2">
                {t('types.adminMessage')}
                <span title={t('adminMessageNote')}>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </span>
              </span>
              <Switch checked disabled />
              <Switch
                checked={pref.emailAdminMessage}
                onCheckedChange={v => update({ emailAdminMessage: v })}
              />
            </div>
          </div>
        )}

        {saving && <p className="text-xs text-muted-foreground">...</p>}
      </div>
    </MyPageLayout>
  )
}
