"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EyeOff, Eye } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ko, enUS } from "date-fns/locale"

interface Conversation {
  uuid: string
  opponent: { id: number; nickname: string; image: string | null }
  lastMessage: { content: string; createdAt: string; senderId: number } | null
  unreadCount: number
  hiddenByMe: boolean
  lastMessageAt: string | null
}

type FilterId = 'all' | 'unread' | 'hidden'

const FILTERS: { id: FilterId }[] = [{ id: 'all' }, { id: 'unread' }, { id: 'hidden' }]

export function ConversationList() {
  const t = useTranslations('mypage.messages')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dfLocale = locale === 'ko' ? ko : enUS

  const [items, setItems] = useState<Conversation[]>([])
  const [filter, setFilter] = useState<FilterId>('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (f: FilterId) => {
    setLoading(true)
    try {
      const q = f === 'hidden' ? '?hidden=true' : ''
      const res = await fetch(`/api/messages${q}`)
      if (!res.ok) return
      const data = await res.json()
      const all: Conversation[] = data.conversations
      const filtered = f === 'unread' ? all.filter(c => c.unreadCount > 0) : all
      setItems(filtered)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(filter) }, [filter, load])

  async function toggleHide(c: Conversation) {
    const next = !c.hiddenByMe
    await fetch(`/api/messages/${c.uuid}/hide`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: next }),
    })
    // remove from current view (filter will drop it)
    setItems(prev => prev.filter(x => x.uuid !== c.uuid))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filter === f.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
            }`}
          >
            {t(`filter.${f.id}`)}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">{t('empty')}</div>
      ) : (
        <div className="space-y-2">
          {items.map(c => (
            <div key={c.uuid} className="group flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
              <Link href={`/mypage/messages/${c.uuid}`} className="flex-1 min-w-0 flex items-start gap-3">
                <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {c.opponent.image ? (
                    <img src={c.opponent.image} alt={c.opponent.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-primary">{(c.opponent.nickname || '?').charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{c.opponent.nickname}</p>
                    {c.lastMessageAt && (
                      <span
                        className="text-xs text-muted-foreground shrink-0"
                        title={new Date(c.lastMessageAt).toLocaleString(locale)}
                      >
                        {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true, locale: dfLocale })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground line-clamp-1 flex-1">
                      {c.lastMessage?.content ?? ''}
                    </p>
                    {c.unreadCount > 0 && <Badge>{c.unreadCount > 99 ? '99+' : c.unreadCount}</Badge>}
                  </div>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => toggleHide(c)}
                title={c.hiddenByMe ? t('unhideAction') : t('hideAction')}
              >
                {c.hiddenByMe ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
