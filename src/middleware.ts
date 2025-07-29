import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export function middleware(request: NextRequest) {
  // 보호된 경로들 (로그인이 필요한 페이지들)
  const protectedPaths = ['/dashboard', '/profile', '/settings'];
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath) {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      // 로그인이 필요한 페이지에 접근하려고 할 때 로그인 페이지로 리다이렉트
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      jwt.verify(token, jwtSecret);
      
      // 토큰이 유효하면 요청을 계속 진행
      return NextResponse.next();
    } catch {
      // 토큰이 유효하지 않으면 쿠키를 삭제하고 로그인 페이지로 리다이렉트
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.set('auth-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 