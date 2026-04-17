"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  userLabel?: string        // e.g. "홍길동 (hong@example.com)"
  prefillLink?: string      // order detail page, etc.
  prefillTitle?: string
}

export function SendNotificationDialog({
  open, onOpenChange, userId, userLabel, prefillLink, prefillTitle,
}: Props) {
  const t = useTranslations('admin.notifications.send')
  const [title, setTitle] = useState(prefillTitle ?? '')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState(prefillLink ?? '')
  const [sendEmail, setSendEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (title.length < 1 || title.length > 100) {
      setError(t('validation.title')); return
    }
    if (message.length < 1 || message.length > 2000) {
      setError(t('validation.message')); return
    }
    if (link && !link.startsWith('/')) {
      setError(t('validation.link')); return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, message, link: link || undefined, sendEmail }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t('failure'))
        return
      }
      // success — reset and close
      setTitle(''); setMessage(''); setLink(''); setSendEmail(false)
      onOpenChange(false)
      alert(t('success'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          {userLabel && <DialogDescription>{userLabel}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="send-title">{t('titleLabel')}</Label>
            <Input id="send-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-message">{t('messageLabel')}</Label>
            <Textarea id="send-message" value={message} onChange={e => setMessage(e.target.value)} rows={6} maxLength={2000} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-link">{t('linkLabel')}</Label>
            <Input id="send-link" value={link} onChange={e => setLink(e.target.value)} placeholder="/path/to/page" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="send-email" checked={sendEmail} onCheckedChange={v => setSendEmail(v === true)} />
            <Label htmlFor="send-email" className="cursor-pointer">{t('sendEmailLabel')}</Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
