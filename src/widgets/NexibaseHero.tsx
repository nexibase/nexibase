"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight, Github } from "lucide-react"
import Link from "next/link"

interface UserInfo {
  nickname: string | null
}

const GITHUB_URL = "https://github.com/nexibase/nexibase"

export default function NexibaseHero() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [siteDescription, setSiteDescription] = useState('')
  const [firstBoardSlug, setFirstBoardSlug] = useState('')
  const [version, setVersion] = useState('')

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
        setSiteDescription(settingsData.settings?.site_description || '')
      }
      if (boardsRes.ok) {
        const boardsData = await boardsRes.json()
        if (boardsData.boards?.length > 0) {
          setFirstBoardSlug(boardsData.boards[0].slug)
        }
      }
    } catch (error) {
      console.error('NexibaseHero 데이터 조회 에러:', error)
    }
  }, [])

  // GitHub 태그에서 최신 버전 가져오기
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const res = await fetch(
          'https://api.github.com/repos/nexibase/nexibase/tags'
        )
        if (!res.ok) return
        const tags = await res.json()
        const tag = tags[0]?.name || ''
        setVersion(tag.startsWith('v') ? tag : tag ? `v${tag}` : '')
      } catch {
        // 버전 조회 실패 시 무시
      }
    }
    fetchVersion()
  }, [])

  useEffect(() => {
    fetchData()
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
            {version && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {version}
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold mb-2">
            {user
              ? `Welcome back, ${user.nickname || 'friend'}!`
              : 'Welcome to NexiBase'
            }
          </h1>
          <p className="text-sm text-muted-foreground">
            {siteDescription || 'An open-source web platform infinitely extensible via plugins'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {firstBoardSlug && (
            <Link href={`/boards/${firstBoardSlug}`}>
              <Button>
                Get started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          )}
          <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <Github className="h-4 w-4 mr-2" />
              GitHub
            </Button>
          </Link>
          <Link href="/contents/about">
            <Button variant="outline">Learn more</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
