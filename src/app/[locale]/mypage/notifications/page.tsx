"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, Check } from "lucide-react"
import Link from "next/link"

interface Notification {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const t = useTranslations('mypage')
  const tc = useTranslations('common')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=50')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
      }
    } catch {
      // error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const markAsRead = async (id: number) => {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const markAllAsRead = async () => {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <MyPageLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('notifications')}
            {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
          </h2>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <Check className="h-4 w-4 mr-1" />
              {t('markAllRead')}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">{t('noNotifications')}</div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
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
                      <p className="text-sm font-medium truncate">{n.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MyPageLayout>
  )
}
