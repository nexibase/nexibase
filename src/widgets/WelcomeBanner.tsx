"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight } from "lucide-react"
import Link from "next/link"

interface UserInfo {
  nickname: string | null
}

export default function WelcomeBanner() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [siteName, setSiteName] = useState('NexiBase')
  const [siteDescription, setSiteDescription] = useState('')
  const [firstBoardSlug, setFirstBoardSlug] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [userRes, settingsRes, boardsRes] = await Promise.all([
        fetch('/api/me'),
        fetch('/api/settings'),
        fetch('/api/boards?limit=1'),
      ])
      if (userRes.ok) {
        const userData = await userRes.json()
        setUser(userData.user)
      } else {
        setUser(null)
      }
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        setSiteName(settingsData.settings.site_name || 'NexiBase')
        setSiteDescription(settingsData.settings.site_description || '')
      }
      if (boardsRes.ok) {
        const boardsData = await boardsRes.json()
        if (boardsData.boards?.length > 0) {
          setFirstBoardSlug(boardsData.boards[0].slug)
        }
      }
    } catch (error) {
      console.error('WelcomeBanner 데이터 조회 에러:', error)
    }
  }, [])

  useEffect(() => {
    fetchData()

    // 페이지 포커스 시 세션 상태 갱신 (로그인/로그아웃 반영)
    const handleFocus = () => fetchData()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchData])

  return (
    <Card className="h-full bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
      <CardContent className="p-6 h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Welcome</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold mb-2">
            {user
              ? `${user.nickname || '사용자'}님, 환영합니다!`
              : `${siteName}에 오신 것을 환영합니다`
            }
          </h1>
          <p className="text-sm text-muted-foreground">
            {siteDescription || '함께 성장하는 커뮤니티에서 다양한 이야기를 나눠보세요.'}
          </p>
        </div>
        <div className="flex gap-2 mt-4">
          {firstBoardSlug && (
            <Link href={`/boards/${firstBoardSlug}`}>
              <Button>
                시작하기
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          )}
          <Link href="/contents/about">
            <Button variant="outline">더 알아보기</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
