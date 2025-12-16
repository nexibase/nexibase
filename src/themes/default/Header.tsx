"use client"

import { useState, useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, Sun, Moon, ChevronDown, Search, Menu, X, Bell, ShoppingCart, Package, Settings } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"

interface UserInfo {
  id: string
  email: string
  name: string | null
  nickname: string | null
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

export default function Header() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: 'NexiBase',
    site_logo: ''
  })
  const [boards, setBoards] = useState<Board[]>([])
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [cartCount, setCartCount] = useState(0)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  // 장바구니 개수 업데이트
  useEffect(() => {
    const updateCartCount = () => {
      try {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]")
        const count = cart.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0)
        setCartCount(count)
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userResponse, settingsResponse, boardsResponse] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/settings'),
          fetch('/api/boards?limit=10')
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
      const response = await fetch('/api/logout', { method: 'POST' })
      if (response.ok) {
        setUser(null)
        router.push('/')
      }
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
  const isActiveBoard = (slug: string) => pathname?.startsWith(`/board/${slug}`)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false)
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

              {/* 데스크톱: 모든 액션 표시 */}
              <div className="hidden md:flex items-center gap-2">
                {!isLoading && (
                  <>
                    {user ? (
                      <>
                        {/* 주문내역 */}
                        <Link href="/shop/orders">
                          <Button variant="ghost" size="icon" className="relative">
                            <Package className="h-5 w-5" />
                          </Button>
                        </Link>
                        {/* 알림 */}
                        <Button variant="ghost" size="icon" className="relative">
                          <Bell className="h-5 w-5" />
                        </Button>
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
                              {(user.nickname || user.name || user.email || '?')[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium max-w-[100px] truncate">
                            {user.nickname || user.name || '사용자'}
                          </span>
                          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
                            <LogOut className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Link href="/login">
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
                            {(user.nickname || user.name || user.email || '?')[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    ) : (
                      <Link href="/login">
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
          <nav className="hidden md:flex items-center gap-1 h-11 overflow-x-auto">
            {/* 홈 */}
            <Link
              href="/"
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                pathname === '/'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              홈
            </Link>

            {/* 인기 */}
            <Link
              href="/popular"
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                pathname === '/popular'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              🔥 인기
            </Link>

            {/* 쇼핑 */}
            <Link
              href="/shop"
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                pathname?.startsWith('/shop')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              🛒 쇼핑
            </Link>

            {/* 구분선 */}
            <div className="w-px h-5 bg-border mx-1" />

            {/* 게시판 탭들 */}
            {boards.slice(0, 5).map((board) => (
              <Link
                key={board.id}
                href={`/board/${board.slug}`}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActiveBoard(board.slug)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {board.name}
              </Link>
            ))}

            {/* 더보기 메뉴 */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                  moreMenuOpen
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                더보기
                <ChevronDown className={`h-4 w-4 transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-background border rounded-lg shadow-lg py-1 z-50">
                  {boards.slice(5).map((board) => (
                    <Link
                      key={board.id}
                      href={`/board/${board.slug}`}
                      className="block px-4 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => setMoreMenuOpen(false)}
                    >
                      {board.name}
                    </Link>
                  ))}
                  <div className="border-t my-1" />
                  <Link
                    href="/content/about"
                    className="block px-4 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => setMoreMenuOpen(false)}
                  >
                    회사소개
                  </Link>
                  <Link
                    href="/content/faq"
                    className="block px-4 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => setMoreMenuOpen(false)}
                  >
                    자주 묻는 질문
                  </Link>
                  <Link
                    href="/content/contact"
                    className="block px-4 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => setMoreMenuOpen(false)}
                  >
                    문의하기
                  </Link>
                  {user?.role === 'admin' && (
                    <>
                      <div className="border-t my-1" />
                      <Link
                        href="/admin"
                        className="block px-4 py-2 text-sm text-primary hover:bg-muted transition-colors"
                        onClick={() => setMoreMenuOpen(false)}
                      >
                        관리자
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
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
                        {(user.nickname || user.name || user.email || '?')[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.nickname || user.name || '사용자'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="border-t my-2" />
                </>
              )}

              <Link
                href="/"
                className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                홈
              </Link>
              <Link
                href="/popular"
                className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                🔥 인기
              </Link>
              <div className="border-t my-2" />
              <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">게시판</div>
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/board/${board.slug}`}
                  className={`block px-3 py-2 text-sm rounded-md ${
                    isActiveBoard(board.slug) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {board.name}
                </Link>
              ))}
              <div className="border-t my-2" />
              <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">쇼핑</div>
              <Link
                href="/shop"
                className={`block px-3 py-2 text-sm rounded-md ${
                  pathname === '/shop' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                상품목록
              </Link>
              <Link
                href="/shop/cart"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md ${
                  pathname === '/shop/cart' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                장바구니
                {cartCount > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">
                    {cartCount}
                  </span>
                )}
              </Link>
              {user && (
                <Link
                  href="/shop/orders"
                  className={`block px-3 py-2 text-sm rounded-md ${
                    pathname === '/shop/orders' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  주문내역
                </Link>
              )}
              <div className="border-t my-2" />
              <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">정보</div>
              <Link
                href="/content/about"
                className="block px-3 py-2 text-sm rounded-md hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                회사소개
              </Link>
              <Link
                href="/content/faq"
                className="block px-3 py-2 text-sm rounded-md hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                자주 묻는 질문
              </Link>
              <Link
                href="/content/contact"
                className="block px-3 py-2 text-sm rounded-md hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                문의하기
              </Link>
              {user?.role === 'admin' && (
                <>
                  <div className="border-t my-2" />
                  <Link
                    href="/admin"
                    className="block px-3 py-2 text-sm font-medium text-primary rounded-md hover:bg-muted"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    관리자
                  </Link>
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
