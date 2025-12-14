"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, LogOut, Sun, Moon } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

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

export function Header() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: 'NexiBase',
    site_logo: ''
  })
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 사용자 정보와 설정을 병렬로 가져옴
        const [userResponse, settingsResponse] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/settings')
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
      const response = await fetch('/api/logout', {
        method: 'POST',
      })

      if (response.ok) {
        setUser(null)
        router.push('/')
      } else {
        alert('로그아웃 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('로그아웃 에러:', error)
      alert('로그아웃 중 오류가 발생했습니다.')
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const getThemeIcon = () => {
    if (!mounted) return <Sun className="h-4 w-4" />
    return theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />
  }

  return (
    <header className="border-b bg-background/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              {settings.site_logo ? (
                <Image
                  src={settings.site_logo}
                  alt={settings.site_name}
                  width={32}
                  height={32}
                  className="h-8 w-auto"
                />
              ) : null}
              <h1 className="text-2xl font-bold text-primary">{settings.site_name}</h1>
            </Link>
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/">
                <Button variant="ghost">홈</Button>
              </Link>
              <Button variant="ghost">프로젝트</Button>
              <Button variant="ghost">스터디</Button>
              {user?.role === 'admin' && (
                <Link href="/admin">
                  <Button variant="ghost">관리자</Button>
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="검색..."
                className="pl-10 w-64"
              />
            </div>

            {/* 테마 토글 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
              title={mounted ? (theme === 'dark' ? '다크 모드' : '라이트 모드') : '테마 변경'}
            >
              {getThemeIcon()}
            </Button>

            {!isLoading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.image || undefined} />
                        <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-medium">
                          {(user.nickname || user.name || user.email || '?')[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground hidden sm:block">
                        {user.nickname || user.name || '사용자'}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="flex items-center space-x-1"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="hidden sm:inline">로그아웃</span>
                    </Button>
                  </div>
                ) : (
                  <>
                    <Link href="/login">
                      <Button>로그인</Button>
                    </Link>
                    <Link href="/signup">
                      <Button variant="outline">회원가입</Button>
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
