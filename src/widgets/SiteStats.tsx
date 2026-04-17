"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, FileText, MessageSquare, TrendingUp } from "lucide-react"
import { useTranslations } from 'next-intl'

interface Stats {
  memberCount: number
  boardCount: number
  postCount: number
  commentCount: number
}

export default function SiteStats() {
  const t = useTranslations('widgets')
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data.stats)
        }
      } catch (error) {
        console.error('SiteStats fetch failed:', error)
      }
    }
    fetchStats()
  }, [])

  if (!stats) {
    return (
      <>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 h-full flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </>
    )
  }

  return (
    <>
      <Card className="group hover:border-blue-500/50 transition-colors">
        <CardContent className="p-4 h-full flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.memberCount.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{t('memberCount')}</div>
          </div>
        </CardContent>
      </Card>
      <Card className="group hover:border-green-500/50 transition-colors">
        <CardContent className="p-4 h-full flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileText className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.postCount.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{t('postCount')}</div>
          </div>
        </CardContent>
      </Card>
      <Card className="group hover:border-purple-500/50 transition-colors">
        <CardContent className="p-4 h-full flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <MessageSquare className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.commentCount.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{t('commentCount')}</div>
          </div>
        </CardContent>
      </Card>
      <Card className="group hover:border-orange-500/50 transition-colors">
        <CardContent className="p-4 h-full flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <TrendingUp className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.boardCount.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{t('boardCount')}</div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
