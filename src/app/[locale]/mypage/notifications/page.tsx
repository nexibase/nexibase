"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Bell, Check, Trash2, MessageSquare, Reply, AtSign, Megaphone, Package,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ko, enUS } from "date-fns/locale"

interface Notification {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

const FILTERS = [
  { id: 'all',          typeParam: '' },
  { id: 'unread',       typeParam: '' },
  { id: 'post_comment', typeParam: 'post_comment' },
  { id: 'comment_reply',typeParam: 'comment_reply' },
  { id: 'mention',      typeParam: 'mention' },
  { id: 'admin_message',typeParam: 'admin_message' },
  { id: 'order_status', typeParam: 'order_status' },
] as const

type FilterId = typeof FILTERS[number]['id']

const PAGE_SIZE = 20

function iconFor(type: string) {
  switch (type) {
    case 'post_comment':  return <MessageSquare className="h-4 w-4" />
    case 'comment_reply': return <Reply className="h-4 w-4" />
    case 'mention':       return <AtSign className="h-4 w-4" />
    case 'admin_message': return <Megaphone className="h-4 w-4" />
    case 'order_status':  return <Package className="h-4 w-4" />
    default:              return <Bell className="h-4 w-4" />
  }
}

export default function NotificationsPage() {
  const t = useTranslations('mypage')
  const tn = useTranslations('mypage.notifications')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dfLocale = locale === 'ko' ? ko : enUS

  const [items, setItems] = useState<Notification[]>([])
  const [filter, setFilter] = useState<FilterId>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchPage = useCallback(async (pageNum: number, filterId: FilterId, append: boolean) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
      })
      if (filterId === 'unread') params.set('unreadOnly', 'true')
      const typeParam = FILTERS.find(f => f.id === filterId)?.typeParam
      if (typeParam) params.set('type', typeParam)
      const res = await fetch(`/api/notifications?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setItems(prev => append ? [...prev, ...data.notifications] : data.notifications)
      setTotalPages(data.pagination?.totalPages ?? 1)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchPage(1, filter, false)
  }, [filter, fetchPage])

  const unreadCount = items.filter(n => !n.isRead).length

  async function markAsRead(id: number) {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    })
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  async function markAllAsRead() {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  async function deleteOne(id: number) {
    await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(n => n.id !== id))
  }

  async function deleteAll() {
    if (!confirm(tn('confirmDeleteAll'))) return
    await fetch('/api/notifications?deleteAll=true', { method: 'DELETE' })
    setItems([])
  }

  return (
    <MyPageLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('notifications.label')}
            {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
          </h2>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <Check className="h-4 w-4 mr-1" />
                {t('markAllRead')}
              </Button>
            )}
            {items.length > 0 && (
              <Button variant="outline" size="sm" onClick={deleteAll}>
                <Trash2 className="h-4 w-4 mr-1" />
                {tn('deleteAll')}
              </Button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filter === f.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
              }`}
            >
              {tn(`filter.${f.id}`)}
            </button>
          ))}
        </div>

        {loading && items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">{t('noNotifications')}</div>
        ) : (
          <div className="space-y-2">
            {items.map(n => (
              <div
                key={n.id}
                className={`group p-4 border rounded-lg cursor-pointer transition-colors ${
                  n.isRead ? 'bg-background' : 'bg-primary/5 border-primary/20'
                }`}
                onClick={() => {
                  if (!n.isRead) markAsRead(n.id)
                  if (n.link) window.location.href = n.link
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.isRead && <span className="w-2 h-2 bg-primary rounded-full shrink-0" />}
                      <span className="text-muted-foreground">{iconFor(n.type)}</span>
                      <p className="text-sm font-medium truncate">{n.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: dfLocale })}
                    </span>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      onClick={(e) => { e.stopPropagation(); deleteOne(n.id) }}
                      aria-label={tn('deleteOne')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {page < totalPages && (
              <div className="pt-2 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => { const next = page + 1; setPage(next); fetchPage(next, filter, true) }}
                >
                  {tn('loadMore')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </MyPageLayout>
  )
}
