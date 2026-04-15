import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { pluginManifest } from '@/plugins/_generated'
import { routing } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'

const intlMiddleware = createMiddleware(routing)
const allPluginSlugs = Object.values(pluginManifest).map(p => p.slug)
const LOCALE_SEGMENTS = routing.locales.map(l => `/${l}`)

// In-memory cache — once 'ready', no re-check for the process lifetime
type InstallState = 'ready' | 'install-required' | 'setup-required'
let cachedState: InstallState | null = null

export function markInstalled() {
  cachedState = 'ready'
}

async function getInstallState(): Promise<InstallState> {
  if (cachedState === 'ready') return 'ready'
  try {
    // Spec Section 3: considered "not installed" only when BOTH conditions hold
    //   1. users table is empty
    //   2. site_initialized setting is missing or not 'true'
    // If either is false, treat as "installed" (protects environments with existing data)
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
    // DB connection failure or missing tables → setup required
    console.error('[install] DB check failed, entering setup-required mode:', err)
    return 'setup-required'
  }
}

/**
 * Reads the site_locale setting from DB. Used to force-overwrite the NEXT_LOCALE
 * cookie on the request so the next-intl middleware rewrites the page with the
 * correct locale.
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
  '/api/auth',  // next-auth session checks etc. (keeps SessionProvider working)
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
      // Pass through on check failure (server may still be starting)
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

  // 1. Install state check (highest priority)
  const state = await getInstallState()
  if (state === 'setup-required') {
    // DB unreachable / tables missing: redirect to setup guide page
    if (!isAllowedPath(pathname, ALLOWED_WHEN_SETUP_REQUIRED)) {
      return NextResponse.redirect(new URL('/setup-required', request.url))
    }
    return NextResponse.next()
  }
  if (state === 'install-required') {
    // Not installed: redirect everything to /install except install paths and static assets
    if (!isAllowedPath(pathname, ALLOWED_WHEN_NOT_INSTALLED)) {
      return NextResponse.redirect(new URL('/install', request.url))
    }
    // Install-related paths pass through (skip next-intl/plugin checks)
    return NextResponse.next()
  }
  // 'ready' state: /install or /setup-required redirects to /admin
  if (
    pathname === '/install' || pathname.startsWith('/install/') ||
    pathname === '/setup-required' || pathname.startsWith('/setup-required/')
  ) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // API: no locale handling, only plugin check + session cookie
  if (pathname.startsWith('/api/')) {
    const blocked = await checkPluginBlocked(request, pathname, true)
    if (blocked) return blocked
    return attachSessionCookie(NextResponse.next(), request)
  }

  // Force-inject DB site_locale into the request cookie so next-intl middleware
  // does not resolve the locale from browser Accept-Language or a stale cookie.
  const dbLocale = await getSiteLocaleForMiddleware()
  if (dbLocale) {
    request.cookies.set('NEXT_LOCALE', dbLocale)
  }

  // Page route: run next-intl
  const intlResponse = intlMiddleware(request)

  // Force the intl response cookie to the DB value as well (sync client browser)
  if (dbLocale) {
    intlResponse.cookies.set('NEXT_LOCALE', dbLocale)
  }

  // If intl performed a redirect/rewrite, return it as-is (with session cookie attached)
  const isIntlRedirect = intlResponse.status === 307 || intlResponse.status === 308
  const isIntlRewrite = intlResponse.headers.get('x-middleware-rewrite') !== null

  if (isIntlRedirect || isIntlRewrite) {
    return attachSessionCookie(intlResponse, request)
  }

  // When intl passes through: run plugin check against the locale-stripped path
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
