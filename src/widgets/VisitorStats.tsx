"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Activity } from "lucide-react"
import type { VisitorStatsData } from "@/lib/gaTypes"
import { useTranslations } from 'next-intl'

const POLL_INTERVAL_MS = 120_000 // 120 seconds

export default function VisitorStats() {
  const t = useTranslations('widgets')
  // null = first fetch not yet completed (show skeleton UI)
  const [stats, setStats] = useState<VisitorStatsData | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/analytics/ga-stats')
        if (res.ok && mounted) {
          const data: VisitorStatsData = await res.json()
          setStats(data)
        }
      } catch {
        // Network error — keep existing values and retry on the next poll
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, POLL_INTERVAL_MS)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  // When GA is not configured, render a static placeholder instead of flashing the skeleton
  if (stats && !stats.configured) {
    return (
      <Card className="h-full">
        <CardContent className="p-4 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">{t('visitorStats')}</h3>
          </div>
          <p className="text-xs text-muted-foreground flex-1 flex items-center">
            {t('gaNotConfigured')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const formatNumber = (n: number) => n.toLocaleString()

  const Skeleton = () => (
    <div className="h-4 w-12 bg-muted animate-pulse rounded inline-block align-middle" />
  )

  return (
    <Card className="h-full">
      <CardContent className="p-4 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{t('visitorStats')}</h3>
        </div>

        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-900">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </div>
          <span className="text-sm text-muted-foreground">{t('now')}</span>
          <span className="ml-auto text-base font-bold text-green-700 dark:text-green-400">
            {stats ? formatNumber(stats.online) : <Skeleton />}
          </span>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between py-1 border-b">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {t('today')}
            </span>
            <span className="font-semibold">
              {stats ? formatNumber(stats.today) : <Skeleton />}
            </span>
          </div>
          <div className="flex items-center justify-between py-1 border-b">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {t('yesterday')}
            </span>
            <span className="font-semibold">
              {stats ? formatNumber(stats.yesterday) : <Skeleton />}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {t('last7days')}
            </span>
            <span className="font-semibold">
              {stats ? formatNumber(stats.sevenDays) : <Skeleton />}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
