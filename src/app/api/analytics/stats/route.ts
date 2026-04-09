import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface Stats {
  online: number
  today: number
  yesterday: number
  total: number
}

// 모듈 스코프 인메모리 캐시 (TTL 120초)
let cache: { data: Stats; expires: number } | null = null
const CACHE_TTL_MS = 120 * 1000

/**
 * 접속자 통계
 * - online: 현재 접속자 (지난 10분 내 고유 세션)
 * - today: 오늘 00:00 이후 고유 방문자
 * - yesterday: 어제 하루 고유 방문자
 * - total: 최근 30일 누적 고유 방문자
 *
 * 모듈 스코프 인메모리 캐시로 DB 부담을 줄인다 (동일 프로세스 내에서 120초 유지).
 */
export async function GET() {
  // 캐시 히트 시 DB 조회 없이 즉시 반환
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json(cache.data)
  }

  try {
    const now = new Date()
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000)

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [online, today, yesterday, total] = await Promise.all([
      prisma.visitLog.findMany({
        where: { createdAt: { gte: tenMinAgo } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
      prisma.visitLog.findMany({
        where: { createdAt: { gte: todayStart } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
      prisma.visitLog.findMany({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
      prisma.visitLog.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
    ])

    const data: Stats = {
      online: online.length,
      today: today.length,
      yesterday: yesterday.length,
      total: total.length,
    }

    cache = { data, expires: Date.now() + CACHE_TTL_MS }
    return NextResponse.json(data)
  } catch (error) {
    console.error('analytics/stats 에러:', error)
    return NextResponse.json(
      { online: 0, today: 0, yesterday: 0, total: 0 },
      { status: 200 }
    )
  }
}
