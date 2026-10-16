'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Bell, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotificationNavigation({ page }: { page: 'settings' | 'history' | 'aligo' }) {
  const t = useTranslations('notifications')
  const title = page === 'aligo' ? '문자·알림톡 · 알리고' : t(page === 'settings' ? 'settings' : 'history')
  const Icon = page === 'aligo' ? MessageSquare : Bell
  const links = [
    { page: 'settings', href: '/admin/notifications/settings', label: t('settings') },
    { page: 'history', href: '/admin/notifications', label: t('history') },
    { page: 'aligo', href: '/admin/notifications/settings/aligo', label: '문자·알림톡 · 알리고' },
  ] as const
  return <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
    <h1 className="text-2xl font-bold flex gap-2 items-center"><Icon className="h-6 w-6" />{title}</h1>
    <nav aria-label="알림 관리" className="flex flex-wrap gap-2">{links.map(link => <Button key={link.page} asChild variant={page === link.page ? 'default' : 'outline'}>
      <Link href={link.href} aria-current={page === link.page ? 'page' : undefined}>{link.label}</Link>
    </Button>)}</nav>
  </div>
}
