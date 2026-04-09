"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Activity } from "lucide-react"

interface Stats {
  online: number
  today: number
  yesterday: number
  total: number
}

const POLL_INTERVAL_MS = 120_000 // 120초

export default function VisitorStats() {
  // null = 아직 첫 fetch 완료 전 (스켈레톤 UI 표시)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/analytics/stats')
        if (res.ok && mounted) {
          const data: Stats = await res.json()
          setStats(data)
        }
      } catch {
        // 네트워크 에러 — 기존 값 유지하고 다음 폴링에서 재시도
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, POLL_INTERVAL_MS)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const formatNumber = (n: number) => n.toLocaleString('ko-KR')

  const Skeleton = () => (
    <div className="h-4 w-12 bg-muted animate-pulse rounded inline-block align-middle" />
  )

  return (
    <Card className="h-full">
      <CardContent className="p-4 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">접속자 통계</h3>
        </div>

        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-900">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </div>
          <span className="text-sm text-muted-foreground">현재 접속</span>
          <span className="ml-auto text-base font-bold text-green-700 dark:text-green-400">
            {stats ? formatNumber(stats.online) : <Skeleton />}
          </span>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between py-1 border-b">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              오늘
            </span>
            <span className="font-semibold">
              {stats ? formatNumber(stats.today) : <Skeleton />}
            </span>
          </div>
          <div className="flex items-center justify-between py-1 border-b">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              어제
            </span>
            <span className="font-semibold">
              {stats ? formatNumber(stats.yesterday) : <Skeleton />}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              누적 (30일)
            </span>
            <span className="font-semibold">
              {stats ? formatNumber(stats.total) : <Skeleton />}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
