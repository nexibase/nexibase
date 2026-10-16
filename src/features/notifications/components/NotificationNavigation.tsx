'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotificationNavigation({ page }: { page: 'settings' | 'events' | 'history' }) {
  const t = useTranslations('notifications')
  const links = [
    { page: 'settings', href: '/admin/notifications/settings', label: t('settings') },
    { page: 'events', href: '/admin/notifications/settings/events', label: '이벤트별 발송 설정' },
    { page: 'history', href: '/admin/notifications', label: t('history') },
  ] as const
  return <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
    <h1 className="text-2xl font-bold flex gap-2 items-center"><Bell className="h-6 w-6" />{links.find(link => link.page === page)!.label}</h1>
    <nav aria-label="알림 관리" className="flex flex-wrap gap-2">{links.map(link => <Button key={link.page} asChild variant={page === link.page ? 'default' : 'outline'}>
      <Link href={link.href} aria-current={page === link.page ? 'page' : undefined}>{link.label}</Link>
    </Button>)}</nav>
  </div>
}
