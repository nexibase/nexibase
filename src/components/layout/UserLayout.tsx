"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useTheme } from "next-themes"
import { Search, LogOut, Sun, Moon, Monitor, Menu, X } from "lucide-react"

interface UserInfo {
  id: string
  email: string
  name: string | null
  nickname: string | null
  image: string | null
  role: string
}

interface UserLayoutProps {
  children: React.ReactNode
}

export function UserLayout({ children }: UserLayoutProps) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/me')
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        }
      } catch (error) {
        console.error('사용자 정보 조회 에러:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchUser()
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

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const ThemeIcon = () => {
    if (!mounted) return <Monitor className="h-4 w-4" />
    if (theme === 'light') return <Sun className="h-4 w-4" />
    if (theme === 'dark') return <Moon className="h-4 w-4" />
    return <Monitor className="h-4 w-4" />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Nav */}
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold text-primary">
                DevCom
              </Link>
              <nav className="hidden md:flex items-center space-x-1">
                <Link href="/">
                  <Button variant="ghost">홈</Button>
                </Link>
                <Link href="/board/free">
                  <Button variant="ghost">자유게시판</Button>
                </Link>
                {user?.role === 'admin' && (
                  <Link href="/admin">
                    <Button variant="ghost">관리자</Button>
                  </Link>
                )}
              </nav>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-3">
              {/* Search (desktop) */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input placeholder="검색..." className="pl-10 w-48 lg:w-64" />
              </div>

              {/* Theme Toggle */}
              <Button variant="ghost" size="icon" onClick={cycleTheme}>
                <ThemeIcon />
              </Button>

              {/* User Section */}
              {!isLoading && (
                <>
                  {user ? (
                    <div className="flex items-center space-x-2">
                      <Link href="/mypage" className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.image || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {(user.nickname || user.name || user.email || '?')[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium hidden sm:block">
                          {user.nickname || user.name || '사용자'}
                        </span>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleLogout}
                        title="로그아웃"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Link href="/login">
                        <Button size="sm">로그인</Button>
                      </Link>
                      <Link href="/signup" className="hidden sm:block">
                        <Button variant="outline" size="sm">회원가입</Button>
                      </Link>
                    </div>
                  )}
                </>
              )}

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t py-4 space-y-2">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input placeholder="검색..." className="pl-10 w-full" />
              </div>
              <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">홈</Button>
              </Link>
              <Link href="/board/free" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">자유게시판</Button>
              </Link>
              {user?.role === 'admin' && (
                <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">관리자</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              &copy; 2025 DevCommunity. All rights reserved.
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground">이용약관</Link>
              <Link href="/privacy" className="hover:text-foreground">개인정보처리방침</Link>
              <Link href="/contact" className="hover:text-foreground">문의하기</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
