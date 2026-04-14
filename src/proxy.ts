import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { pluginManifest } from '@/plugins/_generated'
import { routing } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'

const intlMiddleware = createMiddleware(routing)
const allPluginSlugs = Object.values(pluginManifest).map(p => p.slug)
const LOCALE_SEGMENTS = routing.locales.map(l => `/${l}`)

// In-memory 캐시 — 한 번 'ready'가 되면 프로세스 수명동안 재조회 없음
type InstallState = 'ready' | 'install-required' | 'setup-required'
let cachedState: InstallState | null = null

export function markInstalled() {
  cachedState = 'ready'
}

async function getInstallState(): Promise<InstallState> {
  if (cachedState === 'ready') return 'ready'
  try {
    // 스펙 Section 3: 다음 두 조건이 모두 참일 때만 "미설치"
    //   1. users 테이블이 비어있음
    //   2. site_initialized 설정이 없거나 'true'가 아님
    // 둘 중 하나라도 거짓이면 "설치됨"으로 간주 (기존 데이터 있는 환경 보호)
    const [setting, userCount] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'site_initialized' } }),
      prisma.user.count(),
    ])
    const flagSet = setting?.value === 'true'
    const usersExist = userCount > 0
    const state: InstallState = flagSet || usersExist ? 'ready' : 'install-required'
    if (state === 'ready') cachedState = 'ready'
    return state
  } catch (err) {
    // DB 연결 실패 또는 테이블 없음 → 사전 설정 필요
    console.error('[install] DB check failed, entering setup-required mode:', err)
    return 'setup-required'
  }
}

/**
 * DB에서 site_locale 설정을 읽는다. next-intl 미들웨어가 올바른 locale로
 * 페이지를 rewrite하도록 요청 쿠키에 NEXT_LOCALE을 강제로 덮어쓰는 데 사용.
 */
async function getSiteLocaleForMiddleware(): Promise<string | null> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'site_locale' } })
    return setting?.value || null
  } catch {
    return null
  }
}

const ALLOWED_WHEN_NOT_INSTALLED = [
  '/install',
  '/api/install',
  '/api/auth',  // next-auth 세션 체크 등 (SessionProvider 동작 유지)
  '/_next/',
  '/favicon.ico',
]

const ALLOWED_WHEN_SETUP_REQUIRED = [
  '/setup-required',
  '/api/auth',
  '/_next/',
  '/favicon.ico',
]

function isAllowedPath(pathname: string, allowed: string[]): boolean {
  return allowed.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/'),
  )
}

function stripLocale(pathname: string): string {
  for (const seg of LOCALE_SEGMENTS) {
    if (pathname === seg) return '/'
    if (pathname.startsWith(seg + '/')) return pathname.slice(seg.length)
  }
  return pathname
}

function disabledMessage(_pathname: string): string {
  return 'This feature is disabled.'
}

async function checkPluginBlocked(
  request: NextRequest,
  pathname: string,
  isApi: boolean,
): Promise<NextResponse | null> {
  for (const slug of allPluginSlugs) {
    const isPluginRoute = isApi
      ? (pathname === `/api/${slug}` ||
         pathname.startsWith(`/api/${slug}/`) ||
         pathname === `/api/admin/${slug}` ||
         pathname.startsWith(`/api/admin/${slug}/`))
      : (pathname === `/${slug}` ||
         pathname.startsWith(`/${slug}/`) ||
         pathname === `/admin/${slug}` ||
         pathname.startsWith(`/admin/${slug}/`))

    if (!isPluginRoute) continue

    const folder = Object.entries(pluginManifest).find(([, meta]) => meta.slug === slug)?.[0]
    if (!folder) continue

    try {
      const baseUrl = request.nextUrl.origin
      const res = await fetch(`${baseUrl}/api/settings/plugin-status?folder=${folder}`, {
        headers: { 'x-middleware-check': 'true' },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.enabled === false) {
          if (isApi) {
            const referer = request.headers.get('referer') || ''
            let refPath = ''
            try { refPath = new URL(referer).pathname } catch {}
            return NextResponse.json(
              { error: disabledMessage(refPath) },
              { status: 404 },
            )
          }
          return NextResponse.rewrite(new URL('/not-found', request.url))
        }
      }
    } catch {
      // 체크 실패 시 통과 (서버 시작 중일 수 있음)
    }
  }
  return null
}

function attachSessionCookie(response: NextResponse, request: NextRequest): NextResponse {
  const sessionToken = request.cookies.get('next-auth.session-token')
  if (sessionToken) {
    response.cookies.set({
      name: 'next-auth.session-token',
      value: sessionToken.value,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    })
  }
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Install 상태 체크 (최우선)
  const state = await getInstallState()
  if (state === 'setup-required') {
    // DB 미연결/테이블 없음: setup 안내 페이지로 리다이렉트
    if (!isAllowedPath(pathname, ALLOWED_WHEN_SETUP_REQUIRED)) {
      return NextResponse.redirect(new URL('/setup-required', request.url))
    }
    return NextResponse.next()
  }
  if (state === 'install-required') {
    // 미설치: install 관련 경로와 정적 리소스 외엔 모두 /install로 리다이렉트
    if (!isAllowedPath(pathname, ALLOWED_WHEN_NOT_INSTALLED)) {
      return NextResponse.redirect(new URL('/install', request.url))
    }
    // install 관련 경로는 통과 (next-intl/플러그인 체크 건너뜀)
    return NextResponse.next()
  }
  // 'ready' 상태: /install 또는 /setup-required 접근 시 /admin으로 리다이렉트
  if (
    pathname === '/install' || pathname.startsWith('/install/') ||
    pathname === '/setup-required' || pathname.startsWith('/setup-required/')
  ) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // API는 locale 처리 없이 플러그인 체크 + 세션 쿠키만
  if (pathname.startsWith('/api/')) {
    const blocked = await checkPluginBlocked(request, pathname, true)
    if (blocked) return blocked
    return attachSessionCookie(NextResponse.next(), request)
  }

  // next-intl 미들웨어가 브라우저 Accept-Language 또는 stale 쿠키로
  // locale을 결정하지 않도록, 요청 쿠키에 DB의 site_locale을 강제 주입.
  const dbLocale = await getSiteLocaleForMiddleware()
  if (dbLocale) {
    request.cookies.set('NEXT_LOCALE', dbLocale)
  }

  // 페이지 라우트: next-intl 실행
  const intlResponse = intlMiddleware(request)

  // intl 응답 쿠키도 DB 값으로 강제 설정 (클라이언트 브라우저 동기화)
  if (dbLocale) {
    intlResponse.cookies.set('NEXT_LOCALE', dbLocale)
  }

  // intl이 리다이렉트/리라이트를 수행한 경우 그대로 반환 (세션 쿠키만 붙여서)
  const isIntlRedirect = intlResponse.status === 307 || intlResponse.status === 308
  const isIntlRewrite = intlResponse.headers.get('x-middleware-rewrite') !== null

  if (isIntlRedirect || isIntlRewrite) {
    return attachSessionCookie(intlResponse, request)
  }

  // intl이 통과시킨 경우: locale 제거한 경로로 플러그인 체크
  const pagePath = stripLocale(pathname)
  const blocked = await checkPluginBlocked(request, pagePath, false)
  if (blocked) return blocked

  return attachSessionCookie(NextResponse.next(), request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|uploads|themes|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|txt|xml)$).*)',
  ],
}
