"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  FileText,
  ScrollText,
  ShoppingBag,
  Package,
  Truck,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Star,
  Home,
  User,
  TrendingUp,
  MenuIcon,
  LayoutGrid,
  Puzzle,
  Gavel,
  GitBranch,
  type LucideIcon,
} from "lucide-react"

interface SidebarProps {
  activeMenu?: string
  onMenuChange?: (menu: string) => void
}

interface UserInfo {
  id: number
  name: string
  nickname: string
  email: string
  role: string
}

interface AdminMenuItem {
  label: string
  icon: string
  path?: string
  isGroup?: boolean
  children?: AdminMenuItem[]
}

interface PluginInfo {
  folder: string
  name: string
  slug: string
  enabled: boolean
  adminMenus: AdminMenuItem[]
  hasAdmin: boolean
}

// Icon name to component mapping
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  MessageSquare,
  Settings,
  FileText,
  ScrollText,
  ShoppingBag,
  Package,
  Truck,
  ClipboardList,
  BarChart3,
  Star,
  TrendingUp,
  MenuIcon,
  LayoutGrid,
  Puzzle,
  Gavel,
  ChevronDown,
  ChevronRight,
}

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || FileText
}

// Core menu items that are always shown
const coreMenuItems = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard, path: "/admin" },
  { id: "users", label: "사용자관리", icon: Users, path: "/admin/users" },
  { id: "login-logs", label: "로그인기록", icon: ClipboardList, path: "/admin/login-logs" },
  { id: "settings", label: "환경설정", icon: Settings, path: "/admin/settings" },
  { id: "plugins", label: "플러그인관리", icon: Puzzle, path: "/admin/plugins" },
  { id: "menus", label: "메뉴관리", icon: MenuIcon, path: "/admin/menus" },
  { id: "home-widgets", label: "홈화면관리", icon: LayoutGrid, path: "/admin/home-widgets" },
]

// 캐시된 사용자 정보를 가져오는 함수
const getCachedUser = (): UserInfo | null => {
  if (typeof window === 'undefined') return null
  try {
    const cached = sessionStorage.getItem('admin_user')
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

// 캐시된 플러그인 정보를 가져오는 함수
const getCachedPlugins = (): PluginInfo[] => {
  if (typeof window === 'undefined') return []
  try {
    const cached = sessionStorage.getItem('admin_plugins')
    return cached ? JSON.parse(cached) : []
  } catch {
    return []
  }
}

const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || ''

export function Sidebar({ activeMenu, onMenuChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [user, setUser] = useState<UserInfo | null>(getCachedUser)
  const [plugins, setPlugins] = useState<PluginInfo[]>(getCachedPlugins)
  const [latestVersion, setLatestVersion] = useState<string>('')
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const fetchPlugins = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/plugins')
      if (res.ok) {
        const data = await res.json()
        const pluginList = (data.plugins || []) as PluginInfo[]
        setPlugins(pluginList)
        sessionStorage.setItem('admin_plugins', JSON.stringify(pluginList))
      }
    } catch {
      // Use cached data
    }
  }, [])

  // 마운트 시 사용자 정보 가져오기
  useEffect(() => {
    setMounted(true)

    // 캐시 확인 및 state 업데이트
    const cached = sessionStorage.getItem('admin_user')
    if (cached) {
      try {
        const parsedUser = JSON.parse(cached)
        if (parsedUser.nickname) {
          setUser(parsedUser)
        } else {
          sessionStorage.removeItem('admin_user')
        }
      } catch {
        sessionStorage.removeItem('admin_user')
      }
    }

    // 캐시가 없거나 파싱 실패 시 API 호출
    if (!cached) {
      fetch('/api/me')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.user) {
            setUser(data.user)
            sessionStorage.setItem('admin_user', JSON.stringify(data.user))
          }
        })
        .catch(() => {})
    }

    fetchPlugins()

    // GitHub에서 NexiBase 코어 최신 버전(tag) 가져오기 (세션 캐시 10분)
    const fetchLatestVersion = async () => {
      try {
        const cachedVersion = sessionStorage.getItem('nexibase_latest_version')
        const cachedAt = sessionStorage.getItem('nexibase_latest_version_at')
        const TEN_MIN = 10 * 60 * 1000
        if (cachedVersion && cachedAt && Date.now() - Number(cachedAt) < TEN_MIN) {
          setLatestVersion(cachedVersion)
          return
        }
        const res = await fetch('https://api.github.com/repos/nexibase/nexibase/tags')
        if (!res.ok) return
        const tags = await res.json()
        const tag = tags?.[0]?.name || ''
        const normalized = tag.startsWith('v') ? tag.slice(1) : tag
        if (normalized) {
          setLatestVersion(normalized)
          sessionStorage.setItem('nexibase_latest_version', normalized)
          sessionStorage.setItem('nexibase_latest_version_at', String(Date.now()))
        }
      } catch {
        // 네트워크 실패 시 무시
      }
    }
    fetchLatestVersion()

    // 플러그인 상태 변경 이벤트 리스너
    const handlePluginChange = () => {
      sessionStorage.removeItem('admin_plugins')
      fetchPlugins()
    }
    window.addEventListener('pluginStatusChanged', handlePluginChange)
    return () => window.removeEventListener('pluginStatusChanged', handlePluginChange)
  }, [fetchPlugins])

  // Auto-open group menus based on current path
  useEffect(() => {
    for (const plugin of plugins) {
      if (!plugin.enabled || !plugin.adminMenus) continue
      for (const menu of plugin.adminMenus) {
        if (menu.isGroup && menu.children) {
          const hasActiveChild = menu.children.some(child =>
            child.path && pathname.startsWith(child.path)
          )
          if (hasActiveChild) {
            setOpenGroups(prev => ({ ...prev, [plugin.folder]: true }))
          }
        }
      }
    }
  }, [pathname, plugins])

  // Build dynamic menu items from enabled plugins
  const enabledPlugins = plugins.filter(p => p.enabled && p.hasAdmin && p.adminMenus?.length > 0)

  // Flat menu items from plugins (non-group)
  const pluginFlatMenuItems = enabledPlugins.flatMap(p =>
    (p.adminMenus || [])
      .filter(m => !m.isGroup && m.path)
      .map(m => ({
        id: `plugin-${p.folder}-${m.path}`,
        label: m.label,
        icon: getIcon(m.icon),
        path: m.path!,
      }))
  )

  // Group menu items from plugins
  const pluginGroupMenus = enabledPlugins.flatMap(p =>
    (p.adminMenus || [])
      .filter(m => m.isGroup && m.children)
      .map(m => ({
        folder: p.folder,
        label: m.label,
        icon: getIcon(m.icon),
        children: (m.children || []).map(c => ({
          id: `plugin-${p.folder}-${c.path}`,
          label: c.label,
          icon: getIcon(c.icon),
          path: c.path!,
        })),
      }))
  )

  // All flat menu items (core + plugin flat)
  const allFlatItems = [...coreMenuItems, ...pluginFlatMenuItems]

  // Determine active menu
  const getActiveMenu = () => {
    // Check group menus first
    for (const group of pluginGroupMenus) {
      const exactChild = group.children.find(item => item.path === pathname)
      if (exactChild) return exactChild.id
      const subChild = group.children.find(item =>
        item.path !== '/admin' && pathname.startsWith(item.path + '/')
      )
      if (subChild) return subChild.id
    }

    // Check flat menus
    const exactItem = allFlatItems.find(item => item.path === pathname)
    if (exactItem) return exactItem.id

    const menuItem = allFlatItems.find(item =>
      item.path !== '/admin' && pathname.startsWith(item.path + '/')
    )
    if (menuItem) return menuItem.id

    return "dashboard"
  }

  const handleMenuClick = (item: { id: string; path: string }) => {
    router.push(item.path)
    setIsOpen(false)
    if (onMenuChange) {
      onMenuChange(item.id)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const getThemeIcon = () => {
    if (!mounted) return <Sun className="h-4 w-4" />
    return theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />
  }

  const getThemeLabel = () => {
    if (!mounted) return '라이트'
    return theme === 'dark' ? '다크' : '라이트'
  }

  // 홈으로 이동 (shift 클릭 시 새창)
  const handleHomeClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      window.open('/', '_blank')
    } else {
      router.push('/')
    }
  }

  const currentActiveMenu = activeMenu || getActiveMenu()

  return (
    <>
      {/* 모바일 메뉴 버튼 */}
      <Button
        variant="outline"
        size="sm"
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-background border-r border-border
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* 로고 */}
          <div className="p-6 border-b border-border">
            <h1 className="text-xl font-bold text-foreground">관리자 패널</h1>
          </div>

          {/* 메뉴 */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {/* 홈 링크 & 다크모드 토글 */}
            <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-start"
                onClick={handleHomeClick}
                title="Shift+클릭으로 새창 열기"
              >
                <Home className="mr-2 h-4 w-4" />
                홈으로
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={toggleTheme}
                title={`${getThemeLabel()} 모드`}
              >
                {getThemeIcon()}
              </Button>
            </div>

            {/* Core menu items */}
            {coreMenuItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  variant={currentActiveMenu === item.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => handleMenuClick(item)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              )
            })}

            {/* Plugin flat menu items */}
            {pluginFlatMenuItems.length > 0 && (
              <div className="pt-2 border-t border-border mt-2 space-y-2">
                {pluginFlatMenuItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Button
                      key={item.id}
                      variant={currentActiveMenu === item.id ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => handleMenuClick(item)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Button>
                  )
                })}
              </div>
            )}

            {/* Plugin group menus */}
            {pluginGroupMenus.map((group) => {
              const GroupIcon = group.icon
              const isGroupOpen = openGroups[group.folder] ?? false
              return (
                <div key={group.folder} className="pt-2 border-t border-border mt-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-between"
                    onClick={() => setOpenGroups(prev => ({ ...prev, [group.folder]: !prev[group.folder] }))}
                  >
                    <span className="flex items-center">
                      <GroupIcon className="mr-2 h-4 w-4" />
                      {group.label}
                    </span>
                    {isGroupOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  {isGroupOpen && (
                    <div className="ml-4 mt-1 space-y-1">
                      {group.children.map((item) => {
                        const Icon = item.icon
                        return (
                          <Button
                            key={item.id}
                            variant={currentActiveMenu === item.id ? "default" : "ghost"}
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => handleMenuClick(item)}
                          >
                            <Icon className="mr-2 h-4 w-4" />
                            {item.label}
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* 사용자 정보 */}
            <div className="pt-3 mt-2 border-t border-border">
              <div className="flex items-center gap-2 px-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || user?.nickname || '관리자'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.role === 'admin' ? '관리자' : user?.role === 'manager' ? '부관리자' : user?.role || ''}
                  </p>
                </div>
              </div>
            </div>

            {/* 버전 정보 */}
            {CURRENT_VERSION && (
              <div className="pt-3 mt-2 border-t border-border">
                <div className="px-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Package className="h-3 w-3" />
                      여기 버전
                    </span>
                    <span className="font-mono font-medium">v{CURRENT_VERSION}</span>
                  </div>
                  {latestVersion && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <GitBranch className="h-3 w-3" />
                        최신 버전
                      </span>
                      <a
                        href="https://github.com/nexibase/nexibase/tags"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`font-mono font-medium ${
                          latestVersion !== CURRENT_VERSION
                            ? 'text-amber-600 dark:text-amber-400 underline'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                        title={latestVersion !== CURRENT_VERSION ? '업데이트가 있습니다 — 태그 목록 열기' : '최신 버전을 사용 중입니다'}
                      >
                        v{latestVersion}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </nav>
        </div>
      </div>
    </>
  )
}
