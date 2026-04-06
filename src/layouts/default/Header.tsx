"use client"

import { useState, useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, Sun, Moon, ChevronDown, Search, Menu, X, ShoppingCart, User, Settings, Bell } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"

interface UserInfo {
  id: string
  email: string
  nickname: string
  image: string | null
  role: string
}

interface SiteSettings {
  site_name: string
  site_logo: string
}

interface Board {
  id: number
  slug: string
  name: string
}

interface MenuItem {
  id: number
  label: string
  url: string
  icon: string | null
  target: string
  visibility: string
  isActive: boolean
  sortOrder: number
  children: MenuItem[]
}

interface Notification {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export default function Header() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: 'NexiBase',
    site_logo: ''
  })
  const [boards, setBoards] = useState<Board[]>([])
  const [headerMenus, setHeaderMenus] = useState<MenuItem[]>([])
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [cartCount, setCartCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  // 장바구니 개수 업데이트 (상품 가짓수)
  useEffect(() => {
    const updateCartCount = () => {
      try {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]")
        setCartCount(cart.length) // 상품 가짓수로 표시
      } catch {
        setCartCount(0)
      }
    }

    updateCartCount()
    window.addEventListener("cartUpdated", updateCartCount)
    window.addEventListener("storage", updateCartCount)

    return () => {
      window.removeEventListener("cartUpdated", updateCartCount)
      window.removeEventListener("storage", updateCartCount)
    }
  }, [])

  // 알림 개수 조회
  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/notifications/count')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count)
      }
    } catch (error) {
      console.error('알림 개수 조회 에러:', error)
    }
  }

  // 알림 목록 조회
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=10')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error('알림 목록 조회 에러:', error)
    }
  }

  // 알림 읽음 처리
  const markAsRead = async (notificationId: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })
    } catch (error) {
      console.error('알림 읽음 처리 에러:', error)
    }
  }

  // 모든 알림 읽음 처리
  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      setUnreadCount(0)
      setNotifications(notifications.map(n => ({ ...n, isRead: true })))
    } catch (error) {
      console.error('알림 읽음 처리 에러:', error)
    }
  }

  // 알림 클릭 처리
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
      setNotifications(notifications.map(n =>
        n.id === notification.id ? { ...n, isRead: true } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
    if (notification.link) {
      router.push(notification.link)
    }
    setNotificationOpen(false)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userResponse, settingsResponse, boardsResponse, menusResponse] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/settings'),
          fetch('/api/boards?limit=10'),
          fetch('/api/menus?position=header')
        ])

        if (userResponse.ok) {
          const userData = await userResponse.json()
          setUser(userData.user)
        } else {
          setUser(null)
        }

        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json()
          setSettings({
            site_name: settingsData.settings.site_name || 'NexiBase',
            site_logo: settingsData.settings.site_logo || ''
          })
        }

        if (boardsResponse.ok) {
          const boardsData = await boardsResponse.json()
          setBoards(boardsData.boards || [])
        }

        if (menusResponse.ok) {
          const menusData = await menusResponse.json()
          setHeaderMenus(menusData.menus || [])
        }
      } catch (error) {
        console.error('데이터 조회 에러:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false })
      setUser(null)
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('로그아웃 에러:', error)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setMobileMenuOpen(false)
      setSearchQuery("")
    }
  }

  // 현재 경로가 해당 게시판인지 확인
  const isActiveBoard = (slug: string) => pathname?.startsWith(`/boards/${slug}`)

  // 로그인 시 알림 개수 조회
  useEffect(() => {
    if (user) {
      fetchUnreadCount()
      // 1분마다 알림 개수 갱신
      const interval = setInterval(fetchUnreadCount, 60000)
      return () => clearInterval(interval)
    }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false)
      }
      // 드롭다운 메뉴 닫기
      if (openDropdownId !== null) {
        const target = event.target as HTMLElement
        if (!target.closest('[data-dropdown]')) {
          setOpenDropdownId(null)
        }
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-background border-b">
      {/* 상단 헤더 */}
      <div className="border-b bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* 로고 */}
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              {settings.site_logo ? (
                <Image
                  src={settings.site_logo}
                  alt={settings.site_name}
                  width={28}
                  height={28}
                  className="h-7 w-auto"
                />
              ) : (
                <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">
                    {settings.site_name[0]}
                  </span>
                </div>
              )}
              <span className="text-xl font-bold text-foreground hidden md:block">{settings.site_name}</span>
            </Link>

            {/* 검색 (데스크톱) */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <form onSubmit={handleSearch} className="w-full relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="검색어를 입력하세요..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background border-muted-foreground/20"
                />
              </form>
            </div>

            {/* 우측 액션 */}
            <div className="flex items-center gap-2">
              {/* 테마 토글 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                title={mounted ? (theme === 'dark' ? '라이트 모드' : '다크 모드') : '테마 변경'}
              >
                {mounted ? (
                  theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </Button>

              {/* 장바구니 (항상 표시) */}
              <Link href="/shop/cart">
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </Button>
              </Link>

              {/* 알림 (로그인 시만 표시) */}
              {user && (
                <div className="relative" ref={notificationRef}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    onClick={() => {
                      if (!notificationOpen) {
                        fetchNotifications()
                      }
                      setNotificationOpen(!notificationOpen)
                    }}
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Button>

                  {/* 알림 드롭다운 */}
                  {notificationOpen && (
                    <div className="fixed md:absolute left-2 right-2 md:left-auto md:right-0 top-16 md:top-full md:mt-2 md:w-80 bg-background border rounded-lg shadow-lg z-50">
                      <div className="flex items-center justify-between px-4 py-3 border-b">
                        <span className="font-medium">알림</span>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs text-primary hover:underline"
                          >
                            모두 읽음
                          </button>
                        )}
                      </div>
                      <div className="max-h-[60vh] md:max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                            알림이 없습니다
                          </div>
                        ) : (
                          notifications.map((notification) => (
                            <button
                              key={notification.id}
                              onClick={() => handleNotificationClick(notification)}
                              className={`w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b last:border-b-0 ${
                                !notification.isRead ? 'bg-primary/5' : ''
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {!notification.isRead && (
                                  <span className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                                )}
                                <div className={`flex-1 ${notification.isRead ? 'ml-4' : ''}`}>
                                  <p className="text-sm font-medium line-clamp-1">{notification.title}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(notification.createdAt).toLocaleDateString('ko-KR', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                      <div className="border-t px-4 py-2">
                        <Link
                          href="/shop/mypage?tab=notifications"
                          onClick={() => setNotificationOpen(false)}
                          className="text-xs text-primary hover:underline"
                        >
                          모든 알림 보기
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 데스크톱: 모든 액션 표시 */}
              <div className="hidden md:flex items-center gap-2">
                {!isLoading && (
                  <>
                    {user ? (
                      <>
                        {/* 마이페이지 */}
                        <Link href="/shop/mypage">
                          <Button variant="ghost" size="icon" className="relative">
                            <User className="h-5 w-5" />
                          </Button>
                        </Link>
                        {/* 관리자 바로가기 */}
                        {user.role === 'admin' && (
                          <Link href="/admin">
                            <Button variant="ghost" size="icon" title="관리자">
                              <Settings className="h-5 w-5" />
                            </Button>
                          </Link>
                        )}
                        <div className="flex items-center gap-2 pl-2 border-l">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.image || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                              {(user.nickname || user.email || '?')[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium max-w-[100px] truncate">
                            {user.nickname || '사용자'}
                          </span>
                          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
                            <LogOut className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}>
                          <Button variant="ghost" size="sm">로그인</Button>
                        </Link>
                        <Link href="/signup">
                          <Button size="sm">회원가입</Button>
                        </Link>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* 모바일: 프로필/로그인 + 햄버거 메뉴 */}
              <div className="flex md:hidden items-center gap-1">
                {!isLoading && (
                  <>
                    {user ? (
                      <Link href="/mypage">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.image || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {(user.nickname || user.email || '?')[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    ) : (
                      <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}>
                        <Button variant="ghost" size="sm" className="text-xs px-2">로그인</Button>
                      </Link>
                    )}
                  </>
                )}
                {/* 햄버거 메뉴 버튼 */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 네비게이션 탭 */}
      <div className="bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="hidden md:flex items-center gap-1 h-11 overflow-visible">
            {/* DB 기반 메뉴 렌더링 */}
            {headerMenus.length > 0 ? (
              <>
                {/* 상위 메뉴 (처음 7개를 탭으로 표시) */}
                {headerMenus.filter(m => {
                  if (m.visibility === 'member' && !user) return false
                  if (m.visibility === 'admin' && user?.role !== 'admin') return false
                  return true
                }).slice(0, 7).map((menu, idx) => {
                  const isActive = menu.url === '/'
                    ? pathname === '/'
                    : pathname?.startsWith(menu.url)
                  const hasChildren = menu.children && menu.children.length > 0

                  // 구분선: 첫 4개 메뉴(홈, 인기, 쇼핑, 경매) 이후
                  const showSeparator = idx === 3 && headerMenus.length > 4

                  return (
                    <div key={menu.id} className="flex items-center">
                      {showSeparator && <div className="w-px h-5 bg-border mx-1" />}
                      {hasChildren ? (
                        <div className="relative" data-dropdown>
                          <button
                            onClick={() => setOpenDropdownId(openDropdownId === menu.id ? null : menu.id)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap ${
                              openDropdownId === menu.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                          >
                            {menu.icon ? `${menu.icon} ` : ''}{menu.label}
                            <ChevronDown className={`h-4 w-4 transition-transform ${openDropdownId === menu.id ? 'rotate-180' : ''}`} />
                          </button>
                          {openDropdownId === menu.id && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-background border rounded-lg shadow-lg py-1 z-50">
                              {menu.children.filter(c => {
                                if (c.visibility === 'member' && !user) return false
                                if (c.visibility === 'admin' && user?.role !== 'admin') return false
                                return true
                              }).map((child) => (
                                <Link
                                  key={child.id}
                                  href={child.url}
                                  target={child.target}
                                  className="block px-4 py-2 text-sm hover:bg-muted transition-colors"
                                  onClick={() => setOpenDropdownId(null)}
                                >
                                  {child.icon ? `${child.icon} ` : ''}{child.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Link
                          href={menu.url}
                          target={menu.target}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          {menu.icon ? `${menu.icon} ` : ''}{menu.label}
                        </Link>
                      )}
                    </div>
                  )
                })}

                {/* 나머지 메뉴를 더보기로 */}
                {headerMenus.filter(m => {
                  if (m.visibility === 'member' && !user) return false
                  if (m.visibility === 'admin' && user?.role !== 'admin') return false
                  return true
                }).length > 7 && (
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                        moreMenuOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      더보기
                      <ChevronDown className={`h-4 w-4 transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {moreMenuOpen && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-background border rounded-lg shadow-lg py-1 z-50">
                        {headerMenus.filter(m => {
                          if (m.visibility === 'member' && !user) return false
                          if (m.visibility === 'admin' && user?.role !== 'admin') return false
                          return true
                        }).slice(7).map((menu) => (
                          <Link
                            key={menu.id}
                            href={menu.url}
                            target={menu.target}
                            className="block px-4 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={() => setMoreMenuOpen(false)}
                          >
                            {menu.icon ? `${menu.icon} ` : ''}{menu.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* 폴백: DB 메뉴가 없을 때 기존 하드코딩 유지 */}
                <Link href="/" className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${pathname === '/' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>홈</Link>
                <Link href="/popular" className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${pathname === '/popular' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>인기</Link>
                <Link href="/shop" className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${pathname?.startsWith('/shop') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>쇼핑</Link>
                <div className="w-px h-5 bg-border mx-1" />
                {boards.slice(0, 5).map((board) => (
                  <Link key={board.id} href={`/boards/${board.slug}`} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${isActiveBoard(board.slug) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>{board.name}</Link>
                ))}
              </>
            )}
          </nav>

          {/* 모바일 네비게이션 */}
          {mobileMenuOpen && (
            <nav className="md:hidden py-3 border-t space-y-1">
              {/* 검색 */}
              <div className="px-3 pb-3">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="검색어를 입력하세요..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </form>
              </div>

              {/* 사용자 정보 */}
              {user && (
                <>
                  <div className="px-3 py-2 flex items-center gap-3 bg-muted/50 rounded-md mx-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.image || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {(user.nickname || user.email || '?')[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.nickname || '사용자'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="border-t my-2" />
                </>
              )}

              {/* DB 기반 모바일 메뉴 */}
              {headerMenus.length > 0 ? (
                <>
                  {headerMenus.filter(m => {
                    if (m.visibility === 'member' && !user) return false
                    if (m.visibility === 'admin' && user?.role !== 'admin') return false
                    return true
                  }).map((menu) => (
                    <div key={menu.id}>
                      <Link
                        href={menu.url}
                        target={menu.target}
                        className={`block px-3 py-2 text-sm font-medium rounded-md ${
                          (menu.url === '/' ? pathname === '/' : pathname?.startsWith(menu.url))
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {menu.icon ? `${menu.icon} ` : ''}{menu.label}
                      </Link>
                      {/* 하위 메뉴 */}
                      {menu.children && menu.children.length > 0 && (
                        <div className="ml-4">
                          {menu.children.filter(c => {
                            if (c.visibility === 'member' && !user) return false
                            if (c.visibility === 'admin' && user?.role !== 'admin') return false
                            return true
                          }).map((child) => (
                            <Link
                              key={child.id}
                              href={child.url}
                              target={child.target}
                              className="block px-3 py-2 text-sm rounded-md hover:bg-muted"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              {child.icon ? `${child.icon} ` : ''}{child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {/* 폴백: 하드코딩 메뉴 */}
                  <Link href="/" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>홈</Link>
                  <Link href="/popular" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>인기</Link>
                  <div className="border-t my-2" />
                  {boards.map((board) => (
                    <Link key={board.id} href={`/boards/${board.slug}`} className={`block px-3 py-2 text-sm rounded-md ${isActiveBoard(board.slug) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`} onClick={() => setMobileMenuOpen(false)}>{board.name}</Link>
                  ))}
                </>
              )}
              <div className="border-t my-2" />
              {/* 장바구니 (항상 표시) */}
              <Link
                href="/shop/cart"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md ${pathname === '/shop/cart' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                장바구니
                {cartCount > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">{cartCount}</span>
                )}
              </Link>
              {user && (
                <Link href="/shop/mypage" className={`block px-3 py-2 text-sm rounded-md ${pathname?.startsWith('/shop/mypage') ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`} onClick={() => setMobileMenuOpen(false)}>마이페이지</Link>
              )}
              {user?.role === 'admin' && (
                <>
                  <div className="border-t my-2" />
                  <Link href="/admin" className="block px-3 py-2 text-sm font-medium text-primary rounded-md hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>관리자</Link>
                </>
              )}
              {user && (
                <>
                  <div className="border-t my-2" />
                  <button
                    onClick={() => {
                      handleLogout()
                      setMobileMenuOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-500 rounded-md hover:bg-muted"
                  >
                    로그아웃
                  </button>
                </>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  )
}
