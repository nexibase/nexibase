import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { pluginManifest } from '@/plugins/_generated'
import { routing } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'

const intlMiddleware = createMiddleware(routing)
const allPluginSlugs = Object.values(pluginManifest).map(p => p.slug)
const LOCALE_SEGMENTS = routing.locales.map(l => `/${l}`)

// In-memory 캐시 — 한 번 true가 되면 프로세스 수명동안 재조회 없음
let cachedInitialized: boolean | null = null

export function markInstalled() {
  cachedInitialized = true
}

async function isInstalled(): Promise<boolean> {
  if (cachedInitialized === true) return true
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'site_initialized' },
    })
    const installed = setting?.value === 'true'
    if (installed) cachedInitialized = true
    return installed
  } catch {
    return false
  }
}

const ALLOWED_WHEN_NOT_INSTALLED = [
  '/install',
  '/api/install',
  '/_next/',
  '/favicon.ico',
]

function isAllowedWhenNotInstalled(pathname: string): boolean {
  return ALLOWED_WHEN_NOT_INSTALLED.some(
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
  const installed = await isInstalled()
  if (!installed) {
    // 미설치: install 관련 경로와 정적 리소스 외엔 모두 /install로 리다이렉트
    if (!isAllowedWhenNotInstalled(pathname)) {
      return NextResponse.redirect(new URL('/install', request.url))
    }
    // install 관련 경로는 통과 (next-intl/플러그인 체크 건너뜀)
    return NextResponse.next()
  }
  // 설치됨: /install 접근 시 /admin으로 리다이렉트
  if (pathname === '/install' || pathname.startsWith('/install/')) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // API는 locale 처리 없이 플러그인 체크 + 세션 쿠키만
  if (pathname.startsWith('/api/')) {
    const blocked = await checkPluginBlocked(request, pathname, true)
    if (blocked) return blocked
    return attachSessionCookie(NextResponse.next(), request)
  }

  // 페이지 라우트: next-intl 먼저 실행
  const intlResponse = intlMiddleware(request)

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
