"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useTranslations } from 'next-intl'
import { Skeleton } from "@/components/ui/skeleton"

interface UserInfo {
  nickname: string | null
}

export default function WelcomeBanner({ settings }: { settings?: Record<string, any> }) {
  const t = useTranslations('widgets')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [siteName, setSiteName] = useState(settings?.initialWelcome?.siteName || 'NexiBase')
  const [siteDescription, setSiteDescription] = useState(settings?.initialWelcome?.siteDescription || '')
  const [firstBoardSlug, setFirstBoardSlug] = useState(settings?.initialWelcome?.firstBoardSlug || '')
  const [loading, setLoading] = useState(!settings?.initialWelcome)

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
      console.error('WelcomeBanner fetch failed:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()

    // Refresh session state on page focus (reflect login/logout)
    const handleFocus = () => fetchData()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchData])

  if (loading) {
    return (
      <Card className="h-full bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
        <CardContent className="p-6 h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>
        </CardContent>
      </Card>
    )
  }

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
              ? t('welcomeUser', { nickname: user.nickname || t('defaultNickname') })
              : t('welcomeSite', { siteName })
            }
          </h1>
          <p className="text-sm text-muted-foreground">
            {siteDescription || t('defaultDesc')}
          </p>
        </div>
        <div className="flex gap-2 mt-4">
          {firstBoardSlug && (
            <Link href={`/boards/${firstBoardSlug}`}>
              <Button>
                {t('startBtn')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          )}
          <Link href="/contents/about">
            <Button variant="outline">{t('learnMore')}</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
