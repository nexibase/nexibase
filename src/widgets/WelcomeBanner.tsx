"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useTranslations } from 'next-intl'

interface UserInfo {
  nickname: string | null
}

export default function WelcomeBanner() {
  const t = useTranslations('widgets')
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
      console.error('WelcomeBanner fetch failed:', error)
    }
  }, [])

  useEffect(() => {
    fetchData()

    // Refresh session state on page focus (reflect login/logout)
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
