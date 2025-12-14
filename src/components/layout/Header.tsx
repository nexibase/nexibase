"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, LogOut } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface UserInfo {
  id: string
  email: string
  name: string | null
  nickname: string | null
  image: string | null
  role: string
}

export function Header() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/me')
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('사용자 정보 조회 에러:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
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

  return (
    <header className="border-b bg-background/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <h1 className="text-2xl font-bold text-primary">NexiBase</h1>
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
