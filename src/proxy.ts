import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { pluginManifest } from '@/plugins/_generated'
import { routing } from '@/i18n/routing'

const intlMiddleware = createMiddleware(routing)
const allPluginSlugs = Object.values(pluginManifest).map(p => p.slug)
const LOCALE_SEGMENTS = routing.locales.map(l => `/${l}`)

function stripLocale(pathname: string): string {
  for (const seg of LOCALE_SEGMENTS) {
    if (pathname === seg) return '/'
    if (pathname.startsWith(seg + '/')) return pathname.slice(seg.length)
  }
  return pathname
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
            return NextResponse.json(
              { error: '이 기능은 비활성화되었습니다.' },
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
