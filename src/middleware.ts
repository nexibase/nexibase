import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { pluginManifest } from '@/plugins/_generated'

const allPluginSlugs = Object.values(pluginManifest).map(p => p.slug)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  for (const slug of allPluginSlugs) {
    const isPluginRoute =
      pathname === `/${slug}` ||
      pathname.startsWith(`/${slug}/`) ||
      pathname === `/api/${slug}` ||
      pathname.startsWith(`/api/${slug}/`) ||
      pathname === `/admin/${slug}` ||
      pathname.startsWith(`/admin/${slug}/`) ||
      pathname === `/api/admin/${slug}` ||
      pathname.startsWith(`/api/admin/${slug}/`)

    if (isPluginRoute) {
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
            if (pathname.startsWith('/api/')) {
              return NextResponse.json(
                { error: '이 기능은 비활성화되었습니다.' },
                { status: 404 }
              )
            }
            return NextResponse.rewrite(new URL('/not-found', request.url))
          }
        }
      } catch {
        // Check failure = allow through (server might be starting)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|uploads/).*)',
  ],
}
