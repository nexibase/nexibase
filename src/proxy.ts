import { NextRequest, NextResponse } from 'next/server';
import { pluginManifest } from '@/plugins/_generated';

const allPluginSlugs = Object.values(pluginManifest).map(p => p.slug);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 비활성 플러그인 라우트 차단
  for (const slug of allPluginSlugs) {
    const isPluginRoute =
      pathname === `/${slug}` ||
      pathname.startsWith(`/${slug}/`) ||
      pathname === `/api/${slug}` ||
      pathname.startsWith(`/api/${slug}/`) ||
      pathname === `/admin/${slug}` ||
      pathname.startsWith(`/admin/${slug}/`) ||
      pathname === `/api/admin/${slug}` ||
      pathname.startsWith(`/api/admin/${slug}/`);

    if (isPluginRoute) {
      const folder = Object.entries(pluginManifest).find(([, meta]) => meta.slug === slug)?.[0];
      if (!folder) continue;

      try {
        const baseUrl = request.nextUrl.origin;
        const res = await fetch(`${baseUrl}/api/settings/plugin-status?folder=${folder}`, {
          headers: { 'x-middleware-check': 'true' },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.enabled === false) {
            if (pathname.startsWith('/api/')) {
              return NextResponse.json(
                { error: '이 기능은 비활성화되었습니다.' },
                { status: 404 }
              );
            }
            return NextResponse.rewrite(new URL('/not-found', request.url));
          }
        }
      } catch {
        // 체크 실패 시 통과 (서버 시작 중일 수 있음)
      }
    }
  }

  const response = NextResponse.next();

  // NextAuth 세션 토큰 쿠키를 세션 쿠키로 변환
  const sessionToken = request.cookies.get("next-auth.session-token");

  if (sessionToken) {
    response.cookies.set({
      name: "next-auth.session-token",
      value: sessionToken.value,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image files
     *
     * API 라우트도 포함하여 소셜 로그인 콜백에서 설정되는 쿠키도 처리
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
