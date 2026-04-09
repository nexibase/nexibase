import { headers } from 'next/headers'
import { isbot } from 'isbot'
import { prisma } from '@/lib/prisma'

/**
 * logVisit()에 전달할 요청 스냅샷.
 * Next.js는 after() 콜백 내부에서 headers() 호출을 금지하므로,
 * 호출 측(RootLayout)에서 미리 값을 읽어 전달해야 한다.
 */
export interface VisitContext {
  userAgent: string
  pathname: string
  sessionId: string | null
  referer: string | null
  ip: string
}

/**
 * 현재 요청의 헤더를 읽어 VisitContext 스냅샷을 만든다.
 * 반드시 after() 외부(서버 컴포넌트 본문)에서 호출할 것.
 *
 * 세션 쿠키(nb_visit_sid)는 proxy.ts에서 관리되며, sessionId는
 * x-nexibase-sid 헤더로 이 함수에 전달된다. (after()에서는 응답이
 * 이미 flush되어 cookies().set()이 효과 없으므로 프록시에서 처리)
 */
export async function captureVisitContext(): Promise<VisitContext> {
  const h = await headers()
  const rawPath = h.get('x-nexibase-path') || '/'
  const forwardedFor = h.get('x-forwarded-for')
  const realIp = h.get('x-real-ip')
  return {
    userAgent: h.get('user-agent') || '',
    pathname: extractPathname(rawPath),
    sessionId: h.get('x-nexibase-sid'),
    referer: h.get('referer') || null,
    ip: (forwardedFor?.split(',')[0].trim() || realIp || 'unknown').slice(0, 45),
  }
}

/**
 * 캡처된 요청 스냅샷을 VisitLog에 기록한다.
 * Root layout에서 `after()`로 호출되어 응답 후 백그라운드에 실행된다.
 * 봇 / 정적 자원 / API / admin 경로는 제외한다.
 * DB 에러는 console.error로 로깅만 하고 삼킨다 (after() 콜백이라 페이지 영향 없음).
 */
export async function logVisit(
  ctx: VisitContext,
  userId?: number | null
): Promise<void> {
  try {
    // 봇 제외
    if (!ctx.userAgent || isbot(ctx.userAgent)) return

    // 트래킹 제외 경로
    if (shouldSkip(ctx.pathname)) return

    // 프록시가 sessionId를 주입하지 않은 경우 (예: 테스트) 무시
    if (!ctx.sessionId) return

    await prisma.visitLog.create({
      data: {
        sessionId: ctx.sessionId,
        userId: userId ?? null,
        ip: ctx.ip,
        path: ctx.pathname.slice(0, 500),
        referer: ctx.referer?.slice(0, 500) ?? null,
        userAgent: ctx.userAgent.slice(0, 500),
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
