"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

import { Loader2 } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  userLabel?: string          // e.g. "홍길동 (hong@example.com)"
  prefillContent?: string
  /** 'thread' redirects to /mypage/messages/[id] after success
   *  (default, for member flow). 'none' stays on the current page
   *  (for admin flow). */
  redirectAfter?: 'thread' | 'none'
  /** Legacy prop retained; channel settings and recipient preferences determine delivery. */
  showEmailOption?: boolean
}

export function SendMessageDialog({
  open, onOpenChange, userId, userLabel, prefillContent, redirectAfter = 'thread',
}: Props) {
  const t = useTranslations('admin.messages.send')
  const router = useRouter()
  const [content, setContent] = useState(prefillContent ?? '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setContent(prefillContent ?? '')

      setError(null)
    }
  }, [open, prefillContent])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (content.length < 1 || content.length > 2000) {
      setError(t('validation.content'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: userId,
          content,

        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t('failure'))
        return
      }
      const data = await res.json()
      onOpenChange(false)
      if (redirectAfter === 'thread' && data.conversationUuid) {
        router.push(`/mypage/messages/${data.conversationUuid}`)
      } else {
        alert(t('success'))
      }
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
            <Label htmlFor="dm-content">{t('contentLabel')}</Label>
            <Textarea
              id="dm-content"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              maxLength={2000}
              required
            />
            <p className="text-xs text-muted-foreground text-right">{content.length}/2000</p>
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
