import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 빌드 시 정적 최적화되면 숫자가 프리렌더링되므로 항상 동적 실행 강제
export const dynamic = 'force-dynamic'

interface Stats {
  online: number
  today: number
  yesterday: number
  total: number
}

// 모듈 스코프 인메모리 캐시 (TTL 120초)
let cache: { data: Stats; expires: number } | null = null
const CACHE_TTL_MS = 120 * 1000

// 캐시 스탬피드 방지: 동시 요청은 동일한 promise를 공유
let inflight: Promise<Stats> | null = null

/**
 * 지정 기간 내 고유 세션 수를 MySQL COUNT(DISTINCT)로 카운트한다.
 * findMany+distinct 방식은 모든 sessionId를 메모리에 로드하므로 대용량에서 비효율적.
 */
async function countDistinctSessions(start: Date, end?: Date): Promise<number> {
  const rows = end
    ? await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT \`sessionId\`) AS count
        FROM \`visit_logs\`
        WHERE \`createdAt\` >= ${start} AND \`createdAt\` < ${end}
      `
    : await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT \`sessionId\`) AS count
        FROM \`visit_logs\`
        WHERE \`createdAt\` >= ${start}
      `
  return Number(rows[0]?.count ?? 0)
}

/**
 * 현재 시각 기준 KST(Asia/Seoul, UTC+9) 자정의 Date 객체를 반환.
 * 서버 timezone과 무관하게 항상 한국 시간 기준 00:00:00을 계산한다.
 */
function kstTodayStart(now: Date): Date {
  // UTC 시각을 9시간 전으로 이동하면 "KST 기준 날짜의 UTC 자정"이 됨
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  kst.setUTCHours(0, 0, 0, 0)
  // 다시 UTC로 변환 (KST 00:00 = UTC 전날 15:00)
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000)
}

async function fetchStats(): Promise<Stats> {
  const now = new Date()
  // Invariant: online window(10min) >= 2 * cache TTL(120s) + poll interval(120s),
  // so 접속자 수치가 캐시 주기 경계에서 순간적으로 0이 되지 않는다.
  // 이 관계를 유지하지 않으면 위젯이 깜빡일 수 있음.
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000)

  const todayStart = kstTodayStart(now)
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [online, today, yesterday, total] = await Promise.all([
    countDistinctSessions(tenMinAgo),
    countDistinctSessions(todayStart),
    countDistinctSessions(yesterdayStart, todayStart),
    countDistinctSessions(thirtyDaysAgo),
  ])

  return { online, today, yesterday, total }
}

/**
 * 접속자 통계
 * - online: 현재 접속자 (지난 10분 내 고유 세션)
 * - today: 오늘 00:00 이후 고유 방문자
 * - yesterday: 어제 하루 고유 방문자
 * - total: 최근 30일 누적 고유 방문자
 *
 * 모듈 스코프 인메모리 캐시(TTL 120초) + inflight promise로
 * 캐시 미스 시 동시 요청이 DB를 중복 히트하지 않도록 한다.
 */
export async function GET() {
  // 캐시 히트 시 DB 조회 없이 즉시 반환
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json(cache.data)
  }

  // 이미 진행 중인 조회가 있으면 그 promise를 공유
  if (inflight) {
    try {
      const data = await inflight
      return NextResponse.json(data)
    } catch {
      return NextResponse.json(
        { online: 0, today: 0, yesterday: 0, total: 0 },
        { status: 200 }
      )
    }
  }

  // 첫 요청자가 DB 조회를 담당
  inflight = fetchStats()
    .then((data) => {
      cache = { data, expires: Date.now() + CACHE_TTL_MS }
      return data
    })
    .finally(() => {
      inflight = null
    })

  try {
    const data = await inflight
    return NextResponse.json(data)
  } catch (error) {
    console.error('analytics/stats 에러:', error)
    return NextResponse.json(
      { online: 0, today: 0, yesterday: 0, total: 0 },
      { status: 200 }
    )
  }
}
