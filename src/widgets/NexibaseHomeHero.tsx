"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, Github } from "lucide-react"
import Link from "next/link"

interface UserInfo {
  nickname: string | null
}

const GITHUB_URL = "https://github.com/nexibase/nexibase"

// nexibase.com 홈페이지 전용 — 사이트 자체(_nexibase.com)의 package.json 버전을
// 빌드 타임에 주입된 NEXT_PUBLIC_APP_VERSION 으로 표시한다.
// (업스트림 NexibaseHero 는 GitHub 태그 API 로 CMS 릴리스 버전을 보여준다.)
const SITE_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || ''

export default function NexibaseHomeHero() {
  const t = useTranslations("widgets")
  const [user, setUser] = useState<UserInfo | null>(null)
  const [siteDescription, setSiteDescription] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [userRes, settingsRes] = await Promise.all([
        fetch('/api/me'),
        fetch('/api/settings'),
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
    } catch (error) {
      console.error('NexibaseHomeHero 데이터 조회 에러:', error)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const handleFocus = () => fetchData()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchData])

  const versionLabel = SITE_VERSION ? `v${SITE_VERSION}` : ''

  return (
    <Card className="h-full bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
      <CardContent className="p-6 h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">{t("welcome")}</span>
            {versionLabel && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {versionLabel}
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold mb-2">
            {user
              ? t("welcomeUser", { nickname: user.nickname || t("defaultNickname") })
              : t("welcomeSite", { siteName: "NexiBase" })
            }
          </h1>
          <p className="text-sm text-muted-foreground">
            {siteDescription || t("defaultDesc")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <Github className="h-4 w-4 mr-2" />
              GitHub
            </Button>
          </Link>
          <Link href="/contents/about">
            <Button variant="outline">{t("learnMore")}</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
