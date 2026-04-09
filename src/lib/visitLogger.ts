import { headers, cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { isbot } from 'isbot'
import { prisma } from '@/lib/prisma'

const VISIT_SESSION_COOKIE = 'nb_visit_sid'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30일

/**
 * 현재 요청을 VisitLog에 기록한다.
 * Root layout에서 `after()`로 호출되어 응답 후 백그라운드에 실행된다.
 * 봇 / 정적 자원 / API / admin 경로는 제외한다.
 * DB 에러는 조용히 무시한다 (로깅 실패로 페이지가 죽지 않게).
 */
export async function logVisit(userId?: number | null): Promise<void> {
  try {
    const h = await headers()
    const userAgent = h.get('user-agent') || ''

    // 봇 제외
    if (!userAgent || isbot(userAgent)) return

    const rawPath = h.get('x-nexibase-path') || h.get('referer') || '/'
    const pathname = extractPathname(rawPath)

    // 트래킹 제외 경로
    if (shouldSkip(pathname)) return

    const referer = h.get('referer') || null
    const forwardedFor = h.get('x-forwarded-for')
    const realIp = h.get('x-real-ip')
    const ip = (forwardedFor?.split(',')[0].trim() || realIp || 'unknown').slice(0, 45)

    // 세션 쿠키 (고유 방문자 식별용)
    const cookieStore = await cookies()
    let sessionId = cookieStore.get(VISIT_SESSION_COOKIE)?.value
    if (!sessionId) {
      sessionId = randomBytes(32).toString('hex')
      try {
        cookieStore.set(VISIT_SESSION_COOKIE, sessionId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: SESSION_MAX_AGE,
          path: '/',
        })
      } catch {
        // Server Component에서 cookies().set()은 상황에 따라 에러 가능 — 무시
      }
    }

    await prisma.visitLog.create({
      data: {
        sessionId,
        userId: userId ?? null,
        ip,
        path: pathname.slice(0, 500),
        referer: referer?.slice(0, 500) ?? null,
        userAgent: userAgent.slice(0, 500),
      },
    })
  } catch (err) {
    console.error('[visitLogger] logVisit failed:', err)
  }
}

function extractPathname(url: string): string {
  try {
    if (url.startsWith('http')) {
      return new URL(url).pathname
    }
    return url.split('?')[0]
  } catch {
    return '/'
  }
}

function shouldSkip(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/uploads/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  )
}
