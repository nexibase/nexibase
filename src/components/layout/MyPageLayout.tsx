"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { UserLayout } from "@/components/layout/UserLayout"
import { Badge } from "@/components/ui/badge"
import {
  User, Pencil, Bell,
  ClipboardList, Heart, MapPin, Gavel, ShoppingBag, Package,
  FileText, ScrollText, MessageSquare, Settings, UserMinus,
  type LucideIcon,
} from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  ClipboardList, Heart, MapPin, Gavel, ShoppingBag, Package,
  FileText, ScrollText, MessageSquare, Settings, Bell, User, Pencil, UserMinus,
}

interface UserInfo {
  id: number
  email: string
  nickname: string
  name: string | null
  phone: string | null
  image: string | null
  role: string
}

interface NavItem {
  label: string
  icon: string
  path: string
}

interface PluginWithMenus {
  folder: string
  name: string
  currentSlug: string
  enabled: boolean
  myPageMenus: { label: string, icon: string, subPath: string }[]
}

// Resolve a plugin nav label: if it looks like an i18n key (contains a dot,
// no spaces), translate it; otherwise return as-is.
function resolveNavLabel(label: string, translate: (key: string) => string): string {
  if (!label.includes(' ') && label.includes('.')) {
    try {
      return translate(label)
    } catch {
      return label
    }
  }
  return label
}

// Map of plugin folder → translator factory result (populated per-component)
type PluginNavTranslators = Record<string, (key: string) => string>

export function MyPageLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('mypage')
  const tc = useTranslations('common')
  const ta = useTranslations('admin')
  const tShop = useTranslations('shop')
  const pluginNavTranslators: PluginNavTranslators = {
    shop: tShop as unknown as (key: string) => string,
  }
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [navItems, setNavItems] = useState<NavItem[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then(r => r.ok ? r.json() : null),
      fetch('/api/admin/plugins').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([userData, pluginsData]) => {
      if (userData?.user) {
        setUser(userData.user)
      } else {
        router.push('/login')
      }

      // Build navigation items
      const items: NavItem[] = [
        { label: t('title'), icon: 'User', path: '/mypage' },
        { label: t('editProfile'), icon: 'Pencil', path: '/mypage/profile/edit' },
      ]

      // Append plugin menus
      if (pluginsData?.plugins) {
        for (const p of pluginsData.plugins as PluginWithMenus[]) {
          if (p.enabled && p.myPageMenus?.length > 0) {
            for (const m of p.myPageMenus) {
              const pluginT = pluginNavTranslators[p.folder] ?? ((k: string) => k)
              items.push({
                label: resolveNavLabel(m.label, pluginT),
                icon: m.icon,
                path: `/${p.currentSlug}${m.subPath}`,
              })
            }
          }
        }
      }

      items.push({ label: t('notifications.label'), icon: 'Bell', path: '/mypage/notifications' })
      items.push({ label: t('messages.label'), icon: 'MessageSquare', path: '/mypage/messages' })
      items.push({ label: t('notificationSettings'), icon: 'Settings', path: '/mypage/settings/notifications' })
      setNavItems(items)
    }).finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <UserLayout>
        <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
      </UserLayout>
    )
  }

  if (!user) return null

  // Activate the tab matching the current path
  const isActive = (path: string) => {
    if (path === '/mypage') return pathname === '/mypage'
    return pathname?.startsWith(path.split('?')[0]) || false
  }

  return (
    <UserLayout>
      <div className="max-w-3xl mx-auto">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {user.image ? (
              <img src={user.image} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              <User className="h-7 w-7 text-primary" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{user.nickname}</h1>
              {user.role === 'admin' && <Badge className="text-xs">{ta('roleAdmin')}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex flex-wrap gap-1 mb-6 border-b pb-2">
          {navItems.map((item, idx) => {
            const Icon = iconMap[item.icon] || User
            const active = isActive(item.path)
            return (
              <Link
                key={idx}
                href={item.path}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-md whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Content */}
        {children}
      </div>
    </UserLayout>
  )
}
